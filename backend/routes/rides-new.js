// backend/routes/rides-new.js
import express from "express";
import { getUserFromToken } from "../helpers/auth.js";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

/* ============================================================
   HELPER — AUTO-CLOSE RIDE IF DEPARTURE < 5 MINUTES
============================================================ */
async function autoCloseIfTooLate(ride) {
  try {
    if (!ride?.date || !ride?.time) return;

    const rideDateTime = new Date(`${ride.date}T${ride.time}:00`);
    const now = new Date();
    const diffMinutes = (rideDateTime - now) / 60000;

    if (diffMinutes <= 5 && ride.status === "active") {
      await supabase
        .from("rides")
        .update({ status: "closed_to_requests" })
        .eq("id", ride.id);

      return true;
    }
  } catch (e) {
    console.warn("Auto-close time check failed:", e.message);
  }
  return false;
}

/* ============================================================
   HELPER — Compute remaining ride capacity
============================================================ */
async function computeRemainingCapacity(rideId) {
  // Load ride
  const { data: ride, error: rideErr } = await supabase
    .from("rides")
    .select("seats, small_suitcase_count, large_suitcase_count")
    .eq("id", rideId)
    .single();

  if (rideErr || !ride) throw new Error("Ride not found");

  // Host luggage + seat usage
  const hostSeats = ride.seats ?? 1;
  const hostS = ride.small_suitcase_count ?? 0;
  const hostL = ride.large_suitcase_count ?? 0;

  // Load all passenger requests
  const { data: requests, error: reqErr } = await supabase
    .from("ride_requests")
    .select("seats, luggage_small, luggage_large")
    .eq("ride_id", rideId)
    .in("status", ["pending", "accepted"]);

  if (reqErr) throw reqErr;

  let usedSeats = hostSeats;
  let usedS = hostS;
  let usedL = hostL;

  for (const r of requests) {
    usedSeats += r.seats;
    usedS += r.luggage_small || 0;
    usedL += r.luggage_large || 0;
  }

  // FIXED VEHICLE LIMITS
  const SEAT_LIMIT = 4;
  const MAX_S = 2;
  const MAX_L = 2;

  return {
    remainingSeats: Math.max(0, SEAT_LIMIT - usedSeats),
    remainingBackpacks: Infinity,
    remainingSmall: Math.max(0, MAX_S - usedS),
    remainingLarge: Math.max(0, MAX_L - usedL),
  };
}

/* ============================================================
   1. Passenger REQUEST to join ride
============================================================ */
router.post("/:rideId/request", express.json(), async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { luggage = {}, seats = 1 } = req.body;

    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Load ride
    const { data: ride } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (!ride) return res.status(404).json({ error: "Ride not found" });

    // Auto-close if too late
    const closed = await autoCloseIfTooLate(ride);
    if (closed)
      return res
        .status(400)
        .json({ error: "Ride is no longer accepting requests" });

    if (ride.status !== "active")
      return res.status(400).json({ error: "Ride is not open for booking" });

    // Prevent duplicates
    const { data: existing } = await supabase
      .from("ride_requests")
      .select("id")
      .eq("ride_id", rideId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing)
      return res.json({
        ok: true,
        requestId: existing.id,
        message: "Already requested",
      });

    // Check capacity
    const cap = await computeRemainingCapacity(rideId);

    const B = luggage.backpack || 0;
    const S = luggage.small || 0;
    const L = luggage.large || 0;

    if (seats > cap.remainingSeats)
      return res.status(400).json({ error: "Not enough seats." });

    if (S > cap.remainingSmall)
      return res
        .status(400)
        .json({ error: "Not enough small suitcase space." });

    if (L > cap.remainingLarge)
      return res
        .status(400)
        .json({ error: "Not enough large suitcase space." });

    // Insert request
    const { data: newReq, error: reqErr } = await supabase
      .from("ride_requests")
      .insert({
        ride_id: rideId,
        user_id: user.id,
        seats,
        luggage_backpack: B,
        luggage_small: S,
        luggage_large: L,
        status: "pending",
      })
      .select()
      .single();

    if (reqErr) throw reqErr;

    return res.json({ ok: true, requestId: newReq.id });
  } catch (err) {
    console.error("request ride error:", err);
    return res.status(500).json({ error: "Failed to request ride" });
  }
});

/* ============================================================
   2. HOST DASHBOARD — ride + requests + deposits + payout
   (Version A) — used by HostManageRide.jsx
============================================================ */
router.get("/:rideId/host-dashboard", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // 1️⃣ Load ride and ensure this user is the host
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select(
        "id, user_id, from, to, date, time, status, estimated_fare, seats"
      )
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });

    if (ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    // 2️⃣ Load ride requests with profile info
    const { data: requests, error: reqErr } = await supabase
      .from("ride_requests")
      .select(
        `
        id,
        user_id,
        seats,
        luggage_backpack,
        luggage_small,
        luggage_large,
        status,
        created_at,
        updated_at,
        profiles ( nickname, avatar_url )
      `
      )
      .eq("ride_id", rideId)
      .order("created_at");

    if (reqErr) throw reqErr;

    const requestIds = (requests || []).map((r) => r.id);

    // 3️⃣ Load deposits per request (if any)
    let depositByRequestId = {};
    if (requestIds.length > 0) {
      const { data: deposits, error: depErr } = await supabase
        .from("ride_deposits")
        .select(
          "id, request_id, user_id, amount_minor, platform_fee_minor, currency, status, payment_intent_id"
        )
        .in("request_id", requestIds);

      if (depErr) throw depErr;

      depositByRequestId = Object.fromEntries(
        (deposits || []).map((d) => [d.request_id, d])
      );
    }

    // 4️⃣ Optional: host payout summary
    const { data: payoutRow } = await supabase
      .from("ride_payouts")
      .select("id, status, host_payout_minor, total_seat_minor, host_fee_minor")
      .eq("ride_id", rideId)
      .maybeSingle();

    // 5️⃣ Build enriched request list
    const enrichedRequests = (requests || []).map((r) => {
      const { profiles, ...rest } = r;
      return {
        ...rest,
        profile: profiles || null,
        deposit: depositByRequestId[r.id] || null,
      };
    });

    return res.json({
      ok: true,
      ride,
      requests: enrichedRequests,
      payout: payoutRow || null,
    });
  } catch (err) {
    console.error("host-dashboard error:", err);
    return res.status(500).json({ error: "Failed to load host dashboard" });
  }
});

/* ============================================================
   3. GET capacity
============================================================ */
router.get("/:rideId/capacity", async (req, res) => {
  try {
    const cap = await computeRemainingCapacity(Number(req.params.rideId));
    return res.json({ ok: true, capacity: cap });
  } catch (err) {
    console.error("capacity error:", err);
    return res.status(500).json({ error: "Failed to load capacity" });
  }
});

/* ============================================================
   4. Host GET requests
============================================================ */
router.get("/:rideId/requests", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);

    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Check host
    const { data: ride } = await supabase
      .from("rides")
      .select("user_id")
      .eq("id", rideId)
      .single();

    if (!ride || ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    // Load requests
    const { data: requests } = await supabase
      .from("ride_requests")
      .select(
        `id, user_id, seats, luggage_backpack, luggage_small, luggage_large,
         status, profiles (nickname, avatar_url)`
      )
      .eq("ride_id", rideId);

    // Load deposits
    const { data: deposits } = await supabase
      .from("ride_deposits")
      .select("id, request_id, status, amount_minor")
      .eq("ride_id", rideId);

    const depositMap = Object.fromEntries(
      (deposits || []).map((d) => [d.request_id, d])
    );

    const result = (requests || []).map((r) => ({
      ...r,
      deposit: depositMap[r.id] || null,
    }));

    return res.json({ ok: true, requests: result });
  } catch (err) {
    console.error("load requests error:", err);
    return res.status(500).json({ error: "Failed to load requests" });
  }
});

/* ============================================================
   5. Host ACCEPT request → create deposit
============================================================ */
router.post("/:rideId/requests/:requestId/accept", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const requestId = Number(req.params.requestId);

    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Load ride
    const { data: ride } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    // Auto-close if too late
    const closed = await autoCloseIfTooLate(ride);
    if (closed)
      return res.status(400).json({ error: "Ride no longer accepts requests" });

    if (ride.status !== "active")
      return res.status(400).json({ error: "Ride is not open for booking" });

    // Load request
    const { data: request } = await supabase
      .from("ride_requests")
      .select("*")
      .eq("id", requestId)
      .eq("ride_id", rideId)
      .single();

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending")
      return res.status(400).json({ error: "Request already processed" });

    // Capacity check
    const cap = await computeRemainingCapacity(rideId);

    if (request.seats > cap.remainingSeats)
      return res.status(400).json({ error: "Not enough seats" });

    if (request.luggage_small > cap.remainingSmall)
      return res.status(400).json({ error: "Not enough small suitcase space" });

    if (request.luggage_large > cap.remainingLarge)
      return res.status(400).json({ error: "Not enough large suitcase space" });

    // Accept request
    const { data: updatedReq, error: updErr } = await supabase
      .from("ride_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .select()
      .single();

    if (updErr) throw updErr;

    // Compute simple fare
    const totalFareMinor = Math.round(Number(ride.estimated_fare) * 100);
    const seatMinor = Math.round(totalFareMinor / 4);

    let platformFeeMinorPerSeat =
      seatMinor < 1000 ? 100 : Math.round(seatMinor * 0.1);

    const seats = request.seats;
    const totalSeatMinor = seats * seatMinor;
    const totalPlatformMinor = seats * platformFeeMinorPerSeat;

    // Create deposit
    const depositPayload = {
      ride_id: rideId,
      user_id: request.user_id,
      request_id: request.id,
      amount_minor: totalSeatMinor,
      platform_fee_minor: totalPlatformMinor,
      currency: "gbp",
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const { data: deposit, error: depErr } = await supabase
      .from("ride_deposits")
      .insert(depositPayload)
      .select()
      .single();

    if (depErr) throw depErr;

    // Auto close ride if full
    const capAfter = await computeRemainingCapacity(rideId);
    if (capAfter.remainingSeats === 0) {
      await supabase
        .from("rides")
        .update({ status: "closed_to_requests" })
        .eq("id", rideId);
    }

    return res.json({
      ok: true,
      request: updatedReq,
      deposit,
    });
  } catch (err) {
    console.error("accept request error:", err);
    return res.status(500).json({ error: "Failed to accept request" });
  }
});

/* ============================================================
   6. REJECT request
============================================================ */
router.post("/:rideId/requests/:requestId/reject", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const requestId = Number(req.params.requestId);

    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // load ride
    const { data: ride } = await supabase
      .from("rides")
      .select("user_id")
      .eq("id", rideId)
      .single();

    if (!ride || ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    // load request
    const { data: request } = await supabase
      .from("ride_requests")
      .select("status")
      .eq("id", requestId)
      .single();

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending")
      return res.status(400).json({ error: "Request already processed" });

    const { data: updated, error: updErr } = await supabase
      .from("ride_requests")
      .update({ status: "rejected" })
      .eq("id", requestId)
      .select()
      .single();

    if (updErr) throw updErr;

    return res.json({ ok: true, request: updated });
  } catch (err) {
    console.error("reject request error:", err);
    return res.status(500).json({ error: "Failed to reject request" });
  }
});

/* ============================================================
   7. Host closes ride manually
============================================================ */
router.post("/:rideId/finalise", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    await supabase
      .from("rides")
      .update({ status: "closed_to_requests" })
      .eq("id", rideId);

    return res.json({ ok: true });
  } catch (err) {
    console.error("finalise error:", err);
    return res.status(500).json({ error: "Failed to close ride" });
  }
});

/* ============================================================
   8. Passenger GET deposits
============================================================ */
router.get("/my/deposits", async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data, error } = await supabase
      .from("ride_deposits")
      .select(
        `
        id,
        ride_id,
        request_id,
        amount_minor,
        platform_fee_minor,
        status,
        rides (*),
        ride_requests (*)
      `
      )
      .eq("user_id", user.id);

    if (error) throw error;

    return res.json({ ok: true, deposits: data });
  } catch (err) {
    console.error("my deposits error:", err);
    return res.status(500).json({ error: "Failed to load deposits" });
  }
});

/* ============================================================
   9. Passenger check-in (kept but simplified)
============================================================ */
router.post("/:rideId/check-in", async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Your future check-in logic here

    return res.json({ ok: true });
  } catch (err) {
    console.error("check-in error:", err);
    return res.status(500).json({ error: "Failed to check-in" });
  }
});

export default router;

// HEREEEEEE -----------------------------------

// // backend/routes/rides_new.js
// import express from "express";
// import { getUserFromToken } from "../helpers/auth.js";
// import { supabase } from "../supabaseClient.js";

// const router = express.Router();

// /* ============================================================
//    HELPER — Compute remaining ride capacity
// ============================================================ */
// async function computeRemainingCapacity(rideId) {
//   // 1. Load ride (host data)
//   const { data: ride, error: rideErr } = await supabase
//     .from("rides")
//     .select("seats, small_suitcase_count, large_suitcase_count")
//     .eq("id", rideId)
//     .single();

//   if (rideErr || !ride) throw new Error("Ride not found");

//   // Host usage
//   const hostSeats = ride.seats ?? 1;
//   const hostS = ride.small_suitcase_count ?? 0;
//   const hostL = ride.large_suitcase_count ?? 0;

//   // 2. Load all passenger requests
//   const { data: requests, error: reqErr } = await supabase
//     .from("ride_requests")
//     .select("seats, luggage_small, luggage_large")
//     .eq("ride_id", rideId)
//     .in("status", ["pending", "accepted"]);

//   if (reqErr) throw reqErr;

//   let usedSeats = hostSeats;
//   let usedS = hostS;
//   let usedL = hostL;

//   for (const r of requests) {
//     usedSeats += r.seats;
//     usedS += r.luggage_small || 0;
//     usedL += r.luggage_large || 0;
//   }

//   // FIXED VEHICLE LIMITS
//   const SEAT_LIMIT = 4;
//   const MAX_S = 2; // small suitcases
//   const MAX_L = 2; // large suitcases

//   return {
//     remainingSeats: Math.max(0, SEAT_LIMIT - usedSeats),

//     // ❗ BACKPACKS UNLIMITED
//     remainingBackpacks: Infinity,

//     remainingSmall: Math.max(0, MAX_S - usedS),
//     remainingLarge: Math.max(0, MAX_L - usedL),
//   };
// }

// // ---------------------- Helper: compute fare + fees ----------------------
// function computeFareModel(ride, requests) {
//   const totalFare = Number(ride.estimated_fare || 0);
//   if (!totalFare || totalFare <= 0) {
//     throw new Error("Ride has no valid estimated_fare");
//   }

//   // Convert ride fare to pence
//   const totalFareMinor = Math.round(totalFare * 100);

//   // FIXED 4-SEAT TAXI SYSTEM
//   const seatMinor = Math.round(totalFareMinor / 4); // price per seat in pence

//   // Platform-fee-per-seat
//   let platformFeePerSeatMinor;
//   if (seatMinor < 1000) {
//     platformFeePerSeatMinor = 100; // £1
//   } else {
//     platformFeePerSeatMinor = Math.round(seatMinor * 0.1); // 10%
//   }

//   const perRequest = [];
//   let totalPassengerSeatMinor = 0;
//   let totalPlatformMinor = 0;

//   for (const req of requests) {
//     const seats = Number(req.seats || 0);

//     const seatAmountMinor = seatMinor * seats;
//     const platformFeeMinor = platformFeePerSeatMinor * seats;

//     perRequest.push({
//       request_id: req.id,
//       user_id: req.user_id,
//       seats,
//       seat_amount_minor: seatAmountMinor,
//       platform_fee_minor: platformFeeMinor,
//       total_charge_minor: seatAmountMinor + platformFeeMinor,
//     });

//     totalPassengerSeatMinor += seatAmountMinor;
//     totalPlatformMinor += platformFeeMinor;
//   }

//   // Host fee → *kept as before* (3%)
//   const hostFeeMinor = Math.round(totalPassengerSeatMinor * 0.03);

//   const hostPayoutMinor = totalPassengerSeatMinor - hostFeeMinor;

//   return {
//     seatMinor,
//     platformFeePerSeatMinor,
//     perRequest,
//     totals: {
//       totalPassengerSeatMinor,
//       totalPlatformMinor,
//       hostFeeMinor,
//       hostPayoutMinor,
//       platformRevenueMinor: totalPlatformMinor + hostFeeMinor,
//     },
//   };
// }

// /* ============================================================
//    1. REQUEST TO JOIN RIDE
// ============================================================ */
// router.post("/:rideId/request", express.json(), async (req, res) => {
//   try {
//     const rideId = Number(req.params.rideId);
//     const { luggage = {}, seats = 1 } = req.body;

//     const user = await getUserFromToken(req.headers.authorization);
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     // 1) Check ride exists & active
//     const { data: ride, error: rideErr } = await supabase
//       .from("rides")
//       .select("id, user_id, status")
//       .eq("id", rideId)
//       .single();

//     if (rideErr || !ride)
//       return res.status(404).json({ error: "Ride not found" });

//     if (ride.status !== "active")
//       return res.status(400).json({ error: "Ride is not open for booking" });

//     // 2) Prevent duplicates
//     const { data: existing } = await supabase
//       .from("ride_requests")
//       .select("id")
//       .eq("ride_id", rideId)
//       .eq("user_id", user.id)
//       .maybeSingle();

//     if (existing)
//       return res.json({
//         ok: true,
//         requestId: existing.id,
//         message: "Already requested",
//       });

//     // 3) Compute live capacity
//     const cap = await computeRemainingCapacity(rideId);

//     // Convert luggage to integers
//     const B = luggage.backpack || 0;
//     const S = luggage.small || 0;
//     const L = luggage.large || 0;

//     // 4) Validate seat & luggage availability
//     if (seats > cap.remainingSeats)
//       return res.status(400).json({
//         error: `Not enough seats. Remaining: ${cap.remainingSeats}`,
//       });

//     if (B > cap.remainingBackpacks)
//       return res.status(400).json({
//         error: `Backpack limit exceeded. Remaining: ${cap.remainingBackpacks}`,
//       });

//     if (S > cap.remainingSmall)
//       return res.status(400).json({
//         error: `Small suitcase limit exceeded. Remaining: ${cap.remainingSmall}`,
//       });

//     if (L > cap.remainingLarge)
//       return res.status(400).json({
//         error: `Large suitcase limit exceeded. Remaining: ${cap.remainingLarge}`,
//       });

//     // 5) Insert request
//     const { data: newReq, error: reqErr } = await supabase
//       .from("ride_requests")
//       .insert({
//         ride_id: rideId,
//         user_id: user.id,
//         seats,
//         luggage_backpack: B,
//         luggage_small: S,
//         luggage_large: L,
//         status: "pending",
//       })
//       .select()
//       .single();

//     if (reqErr) throw reqErr;

//     return res.json({ ok: true, requestId: newReq.id });
//   } catch (err) {
//     console.error("request ride error:", err);
//     return res.status(500).json({ error: "Failed to request ride" });
//   }
// });

// /* ============================================================
//    2. GET LIVE CAPACITY (Frontend uses this)
// ============================================================ */
// router.get("/:rideId/capacity", async (req, res) => {
//   try {
//     const rideId = Number(req.params.rideId);
//     const cap = await computeRemainingCapacity(rideId);
//     return res.json({ ok: true, capacity: cap });
//   } catch (err) {
//     console.error("capacity error:", err);
//     return res.status(500).json({ error: "Failed to load capacity" });
//   }
// });

// /* ============================================================
//    3. GET ALL REQUESTS FOR A RIDE (Host only)
// ============================================================ */
// router.get("/:rideId/requests", async (req, res) => {
//   try {
//     const rideId = Number(req.params.rideId);
//     const user = await getUserFromToken(req.headers.authorization);
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     // Check ride exists
//     const { data: ride, error: rideErr } = await supabase
//       .from("rides")
//       .select("user_id")
//       .eq("id", rideId)
//       .single();

//     if (rideErr || !ride)
//       return res.status(404).json({ error: "Ride not found" });

//     // Only host can view
//     if (ride.user_id !== user.id)
//       return res.status(403).json({ error: "Not your ride" });

//     // Load requests with profile info
//     const { data: requests, error: reqErr } = await supabase
//       .from("ride_requests")
//       .select(
//         `
//     id,
//     user_id,
//     seats,
//     luggage_backpack,
//     luggage_small,
//     luggage_large,
//     status,
//     profiles ( nickname, avatar_url )
//   `
//       )
//       .eq("ride_id", rideId)
//       .order("created_at");

//     if (reqErr) throw reqErr;

//     // Load deposits for this ride (if any)
//     const { data: deposits, error: depErr } = await supabase
//       .from("ride_deposits")
//       .select("id, request_id, status, amount_minor")
//       .eq("ride_id", rideId);

//     if (depErr) throw depErr;

//     // Attach deposit to each request (by request_id)
//     const depositByRequestId = Object.fromEntries(
//       (deposits || []).map((d) => [d.request_id, d])
//     );

//     const withDeposits = (requests || []).map((r) => ({
//       ...r,
//       deposit: depositByRequestId[r.id] || null,
//     }));

//     return res.json({ ok: true, requests: withDeposits });
//   } catch (err) {
//     console.error("get requests error:", err);
//     return res.status(500).json({ error: "Failed to load requests" });
//   }
// });
// /* ============================================================
//    4A. ACCEPT REQUEST (Host only) — (Host only) — clean new version
//    Creates deposit using the NEW pricing model
// ============================================================ */

// router.post("/:rideId/requests/:requestId/accept", async (req, res) => {
//   try {
//     const rideId = Number(req.params.rideId);
//     const requestId = Number(req.params.requestId);

//     // 1️⃣ Auth
//     const user = await getUserFromToken(req.headers.authorization);
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     // 2️⃣ Load ride
//     const { data: ride, error: rideErr } = await supabase
//       .from("rides")
//       .select("*")
//       .eq("id", rideId)
//       .single();

//     if (rideErr || !ride)
//       return res.status(404).json({ error: "Ride not found" });
//     if (ride.user_id !== user.id)
//       return res.status(403).json({ error: "Not your ride" });

//     if (ride.status !== "active")
//       return res.status(400).json({ error: "Ride is not open for booking" });

//     // 3️⃣ Load passenger request
//     const { data: request, error: reqErr } = await supabase
//       .from("ride_requests")
//       .select("*")
//       .eq("id", requestId)
//       .eq("ride_id", rideId)
//       .single();

//     if (reqErr || !request)
//       return res.status(404).json({ error: "Request not found" });

//     if (request.status !== "pending")
//       return res.status(400).json({ error: "Request already processed" });

//     // 4️⃣ Check vehicle capacity & luggage
//     const cap = await computeRemainingCapacity(rideId);

//     if (request.seats > cap.remainingSeats)
//       return res.status(400).json({
//         error: `Not enough seats left. Remaining: ${cap.remainingSeats}`,
//       });

//     if (request.luggage_small > cap.remainingSmall)
//       return res.status(400).json({
//         error: `Not enough small suitcase space. Remaining: ${cap.remainingSmall}`,
//       });

//     if (request.luggage_large > cap.remainingLarge)
//       return res.status(400).json({
//         error: `Not enough large suitcase space. Remaining: ${cap.remainingLarge}`,
//       });

//     // 5️⃣ Accept the request
//     const { data: updatedReq, error: updErr } = await supabase
//       .from("ride_requests")
//       .update({ status: "accepted", updated_at: new Date().toISOString() })
//       .eq("id", requestId)
//       .select()
//       .single();

//     if (updErr) throw updErr;

//     // 6️⃣ Compute seat price using NEW simple model
//     const totalFarePence = Math.round(Number(ride.estimated_fare) * 100);
//     const seatPriceMinor = Math.round(totalFarePence / 4); // ALWAYS 4 seats

//     // Platform fee rules:
//     let platformFeeMinorPerSeat;
//     if (seatPriceMinor < 1000) {
//       platformFeeMinorPerSeat = 100; // £1
//     } else {
//       platformFeeMinorPerSeat = Math.round(seatPriceMinor * 0.1); // 10%
//     }

//     const seats = Number(request.seats);
//     const totalSeatPriceMinor = seatPriceMinor * seats;
//     const totalPlatformFeeMinor = platformFeeMinorPerSeat * seats;

//     // 7️⃣ Create deposit row
//     const depositPayload = {
//       ride_id: rideId,
//       user_id: request.user_id,
//       request_id: request.id,
//       amount_minor: totalSeatPriceMinor, // host earnings
//       platform_fee_minor: totalPlatformFeeMinor, // platform fee
//       currency: "gbp",
//       status: "pending",
//       created_at: new Date().toISOString(),
//     };

//     const { data: deposit, error: depErr } = await supabase
//       .from("ride_deposits")
//       .insert(depositPayload)
//       .select()
//       .single();

//     if (depErr) {
//       console.error("Deposit creation failed:", depErr);
//       return res.status(500).json({ error: "Deposit could not be created" });
//     }

//     // 8️⃣ Auto-finalise if ride becomes full
//     let autoFinalised = false;
//     const capAfter = await computeRemainingCapacity(rideId);

//     if (capAfter.remainingSeats === 0) {
//       // Ride is now full → move to pending_payment
//       await supabase
//         .from("rides")
//         .update({ status: "pending_payment" })
//         .eq("id", rideId);

//       autoFinalised = true;
//     }

//     return res.json({
//       ok: true,
//       request: updatedReq,
//       deposit,
//       autoFinalised,
//     });
//   } catch (err) {
//     console.error("accept request error:", err);
//     return res.status(500).json({ error: "Failed to accept request" });
//   }
// });

// // ============================================================
// // 3AA HELPER — Maybe release funds after all check-ins completed
// // ============================================================
// async function maybeReleaseFunds(rideId) {
//   // 1. Load all paid deposits
//   const { data: deposits } = await supabase
//     .from("ride_deposits")
//     .select("*")
//     .eq("ride_id", rideId)
//     .eq("status", "paid");

//   // 2. Required: accepted requests
//   const { data: reqs } = await supabase
//     .from("ride_requests")
//     .select("id, user_id")
//     .eq("ride_id", rideId)
//     .eq("status", "accepted");

//   // 3. Check-ins (ride_pool_contributions)
//   const { data: contributions } = await supabase
//     .from("ride_pool_contributions")
//     .select("user_id, checked_in_at")
//     .eq("ride_pool_id", rideId);

//   const acceptedCount = reqs.length;
//   const checkedInCount = contributions.filter((c) => c.checked_in_at).length;

//   if (checkedInCount !== acceptedCount) {
//     return; // not ready yet
//   }

//   // 4. Load payout row
//   const { data: payoutRow } = await supabase
//     .from("ride_payouts")
//     .select("id, host_user_id, host_payout_minor, stripe_account_id")
//     .eq("ride_id", rideId)
//     .single();

//   if (!payoutRow) return;

//   // 5. RELEASE FUNDS to host's Stripe Connect account
//   await stripe.transfers.create({
//     amount: payoutRow.host_payout_minor,
//     currency: "gbp",
//     destination: payoutRow.stripe_account_id,
//   });

//   // 6. Mark payout as completed
//   await supabase
//     .from("ride_payouts")
//     .update({ status: "paid" })
//     .eq("ride_id", rideId);

//   console.log("Funds released for ride:", rideId);
// }

// /* ============================================================
//    3B. HOST DASHBOARD DATA (ride + requests + deposits + payout)
// ============================================================ */
// router.get("/:rideId/host-dashboard", async (req, res) => {
//   try {
//     const rideId = Number(req.params.rideId);
//     const user = await getUserFromToken(req.headers.authorization);
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     // 1️⃣ Load ride and ensure this user is the host
//     const { data: ride, error: rideErr } = await supabase
//       .from("rides")
//       .select(
//         "id, user_id, from, to, date, time, status, estimated_fare, seats"
//       )
//       .eq("id", rideId)
//       .single();

//     if (rideErr || !ride)
//       return res.status(404).json({ error: "Ride not found" });

//     if (ride.user_id !== user.id)
//       return res.status(403).json({ error: "Not your ride" });

//     // 2️⃣ Load ride requests with profile info
//     const { data: requests, error: reqErr } = await supabase
//       .from("ride_requests")
//       .select(
//         `
//         id,
//         user_id,
//         seats,
//         luggage_backpack,
//         luggage_small,
//         luggage_large,
//         status,
//         created_at,
//         updated_at,
//         profiles ( nickname, avatar_url )
//       `
//       )
//       .eq("ride_id", rideId)
//       .order("created_at");

//     if (reqErr) throw reqErr;

//     const requestIds = (requests || []).map((r) => r.id);

//     // 3️⃣ Load deposits per request (if any)
//     let depositByRequestId = {};
//     if (requestIds.length > 0) {
//       const { data: deposits, error: depErr } = await supabase
//         .from("ride_deposits")
//         .select(
//           "id, request_id, user_id, amount_minor, platform_fee_minor, currency, status, payment_intent_id"
//         )
//         .in("request_id", requestIds);

//       if (depErr) throw depErr;

//       depositByRequestId = Object.fromEntries(
//         (deposits || []).map((d) => [d.request_id, d])
//       );
//     }

//     // 4️⃣ Optional: host payout summary
//     const { data: payoutRow } = await supabase
//       .from("ride_payouts")
//       .select("id, status, host_payout_minor, total_seat_minor, host_fee_minor")
//       .eq("ride_id", rideId)
//       .maybeSingle();

//     // 5️⃣ Build enriched request list
//     const enrichedRequests = (requests || []).map((r) => {
//       const { profiles, ...rest } = r;
//       return {
//         ...rest,
//         profile: profiles || null,
//         deposit: depositByRequestId[r.id] || null,
//       };
//     });

//     return res.json({
//       ok: true,
//       ride,
//       requests: enrichedRequests,
//       payout: payoutRow || null,
//     });
//   } catch (err) {
//     console.error("host-dashboard error:", err);
//     return res
//       .status(500)
//       .json({ error: "Failed to load host dashboard for this ride" });
//   }
// });

// /* ============================================================
//    4B. REJECT REQUEST (Host only)
// ============================================================ */
// router.post("/:rideId/requests/:requestId/reject", async (req, res) => {
//   try {
//     const rideId = Number(req.params.rideId);
//     const requestId = Number(req.params.requestId);

//     const user = await getUserFromToken(req.headers.authorization);
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     // Check ride & host
//     const { data: ride } = await supabase
//       .from("rides")
//       .select("user_id")
//       .eq("id", rideId)
//       .single();

//     if (!ride) return res.status(404).json({ error: "Ride not found" });
//     if (ride.user_id !== user.id)
//       return res.status(403).json({ error: "Not your ride" });

//     // Check request
//     const { data: request } = await supabase
//       .from("ride_requests")
//       .select("id, status")
//       .eq("id", requestId)
//       .eq("ride_id", rideId)
//       .single();

//     if (!request) return res.status(404).json({ error: "Request not found" });
//     if (request.status !== "pending")
//       return res.status(400).json({ error: "Request already processed" });

//     // Update status
//     const { data: updated, error: updErr } = await supabase
//       .from("ride_requests")
//       .update({ status: "rejected", updated_at: new Date().toISOString() })
//       .eq("id", requestId)
//       .select()
//       .single();

//     if (updErr) throw updErr;

//     return res.json({ ok: true, request: updated });
//   } catch (err) {
//     console.error("reject request error:", err);
//     return res.status(500).json({ error: "Failed to reject request" });
//   }
// });
// // ============================================================
// // INTERNAL: finalise ride → create deposits + payout
// // Can be called from: manual route OR auto-finalise in /accept
// // ============================================================
// async function finaliseRideInternal(rideId, hostUserId = null) {
//   // 1️⃣ Load ride & check host (if hostUserId provided)
//   const { data: ride, error: rideErr } = await supabase
//     .from("rides")
//     .select("id, user_id, estimated_fare, seats")
//     .eq("id", rideId)
//     .single();

//   if (rideErr || !ride) {
//     return { ok: false, status: 404, error: "Ride not found" };
//   }

//   if (hostUserId && ride.user_id !== hostUserId) {
//     return { ok: false, status: 403, error: "Only the host can finalise" };
//   }

//   // 2️⃣ Prevent double-finalise
//   const { data: existingDeposits, error: depCheckErr } = await supabase
//     .from("ride_deposits")
//     .select("id")
//     .eq("ride_id", rideId)
//     .limit(1);

//   if (depCheckErr) {
//     console.error("deposit check error:", depCheckErr);
//     return {
//       ok: false,
//       status: 500,
//       error: "Failed to check existing deposits",
//     };
//   }

//   if (existingDeposits && existingDeposits.length > 0) {
//     // Already done — not an error, just tell caller
//     return {
//       ok: true,
//       alreadyFinalised: true,
//       message: "Ride already has deposits",
//     };
//   }

//   // 3️⃣ Load accepted requests
//   const { data: acceptedReqs, error: reqErr } = await supabase
//     .from("ride_requests")
//     .select("id, user_id, seats")
//     .eq("ride_id", rideId)
//     .eq("status", "accepted");

//   if (reqErr) {
//     console.error("load accepted requests error:", reqErr);
//     return { ok: false, status: 500, error: "Failed to load ride requests" };
//   }

//   if (!acceptedReqs || acceptedReqs.length === 0) {
//     return {
//       ok: false,
//       status: 400,
//       error: "No accepted requests to finalise",
//     };
//   }

//   // 4️⃣ Compute fare model (seat share + platform + host fee)
//   let fare;
//   try {
//     fare = computeFareModel(ride, acceptedReqs);
//   } catch (err) {
//     console.error("fare compute error:", err);
//     return {
//       ok: false,
//       status: 500,
//       error: err.message || "Failed to compute fare",
//     };
//   }

//   // 5️⃣ Insert deposits per request
//   const depositRows = fare.perRequest.map((r) => ({
//     ride_id: rideId,
//     user_id: r.user_id,
//     request_id: r.request_id,
//     amount_minor: r.seat_amount_minor, // seat share
//     platform_fee_minor: r.platform_fee_minor,
//     currency: "gbp",
//     status: "pending", // not yet paid
//   }));

//   const { data: insertedDeposits, error: depErr } = await supabase
//     .from("ride_deposits")
//     .insert(depositRows)
//     .select(
//       "id, request_id, user_id, amount_minor, platform_fee_minor, status"
//     );

//   if (depErr) {
//     console.error("insert deposits error:", depErr);
//     return { ok: false, status: 500, error: "Failed to create deposits" };
//   }

//   // 6️⃣ Create host payout stub
//   const { totals } = fare;
//   const { data: payoutRow, error: payoutErr } = await supabase
//     .from("ride_payouts")
//     .insert({
//       ride_id: rideId,
//       host_user_id: ride.user_id,
//       currency: "gbp",
//       total_seat_minor: totals.totalPassengerSeatMinor,
//       host_fee_minor: totals.hostFeeMinor,
//       host_payout_minor: totals.hostPayoutMinor,
//       status: "pending",
//     })
//     .select()
//     .single();

//   if (payoutErr) {
//     console.error("insert payout error:", payoutErr);
//     return { ok: false, status: 500, error: "Failed to create host payout" };
//   }

//   // 7️⃣ Update ride status
//   await supabase
//     .from("rides")
//     .update({ status: "pending_payment" })
//     .eq("id", rideId);

//   return {
//     ok: true,
//     alreadyFinalised: false,
//     seatShareMinor: fare.seatShareMinor,
//     deposits: insertedDeposits,
//     hostPayout: payoutRow,
//     totals: fare.totals,
//   };
// }

// /* ============================================================
//    5. FINALISE RIDE (host locks in payouts & deposits)
// ============================================================ */
// router.post("/:rideId/finalise", async (req, res) => {
//   try {
//     const rideId = Number(req.params.rideId);
//     const user = await getUserFromToken(req.headers.authorization);
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     const { data: ride } = await supabase
//       .from("rides")
//       .select("user_id, status")
//       .eq("id", rideId)
//       .single();

//     if (!ride) return res.status(404).json({ error: "Ride not found" });
//     if (ride.user_id !== user.id)
//       return res.status(403).json({ error: "Not your ride" });

//     await supabase
//       .from("rides")
//       .update({ status: "closed_to_requests" })
//       .eq("id", rideId);

//     return res.json({ ok: true, message: "Ride closed to new requests" });
//   } catch (err) {
//     console.error("finalise error:", err);
//     return res.status(500).json({ error: "Failed to close ride" });
//   }
// });
// // ============================================================
// // 6. GET passenger's deposits for rides
// // ============================================================
// router.get("/my/deposits", async (req, res) => {
//   try {
//     const user = await getUserFromToken(req.headers.authorization);
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     const { data, error } = await supabase
//       .from("ride_deposits")
//       .select(
//         `
//         id,
//         ride_id,
//         request_id,
//         amount_minor,
//         platform_fee_minor,
//         status,
//         rides (*, profiles(*)),
//         ride_requests (seats, status)
//       `
//       )
//       .eq("user_id", user.id);

//     if (error) throw error;

//     return res.json({ ok: true, deposits: data });
//   } catch (err) {
//     console.error("my deposits error:", err);
//     return res.status(500).json({ error: "Failed to load deposits" });
//   }
// });
// // ============================================================
// // 7. Passenger Check-In
// // ============================================================
// router.post("/:rideId/check-in", async (req, res) => {
//   try {
//     const rideId = Number(req.params.rideId);
//     const user = await getUserFromToken(req.headers.authorization);
//     if (!user) return res.status(401).json({ error: "Unauthorized" });

//     // Mark checked in
//     const { error: updateErr } = await supabase
//       .from("ride_pool_contributions")
//       .update({ checked_in_at: new Date().toISOString() })
//       .eq("ride_pool_id", rideId)
//       .eq("user_id", user.id);

//     if (updateErr) throw updateErr;

//     // 🚀 NEW: Try releasing funds
//     await maybeReleaseFunds(rideId);

//     return res.json({ ok: true });
//   } catch (err) {
//     console.error("check-in error:", err);
//     return res.status(500).json({ error: "Failed to check-in" });
//   }
// });

// export default router;
