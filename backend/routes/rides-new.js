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
/* ============================================================
   DELETE RIDE (Host only)
============================================================ */
router.delete("/:rideId/delete", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);

    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Load ride & check ownership
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("user_id, status")
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });

    if (ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    // Delete ride
    const { error: deleteErr } = await supabase
      .from("rides")
      .delete()
      .eq("id", rideId);

    if (deleteErr) throw deleteErr;

    return res.json({ ok: true, message: "Ride deleted" });
  } catch (err) {
    console.error("delete ride error:", err);
    return res.status(500).json({ error: "Failed to delete ride" });
  }
});

export default router;
