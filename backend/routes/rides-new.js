// backend/routes/rides_new.js
import express from "express";
import { getUserFromToken } from "../helpers/auth.js";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

/* ============================================================
   HELPER — Compute remaining ride capacity
============================================================ */
async function computeRemainingCapacity(rideId) {
  // 1. Load ride (host data)
  const { data: ride, error: rideErr } = await supabase
    .from("rides")
    .select("seats, small_suitcase_count, large_suitcase_count")
    .eq("id", rideId)
    .single();

  if (rideErr || !ride) throw new Error("Ride not found");

  // Host usage
  const hostSeats = ride.seats ?? 1;
  const hostS = ride.small_suitcase_count ?? 0;
  const hostL = ride.large_suitcase_count ?? 0;

  // 2. Load all passenger requests
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
  const MAX_S = 2; // small suitcases
  const MAX_L = 2; // large suitcases

  return {
    remainingSeats: Math.max(0, SEAT_LIMIT - usedSeats),

    // ❗ BACKPACKS UNLIMITED
    remainingBackpacks: Infinity,

    remainingSmall: Math.max(0, MAX_S - usedS),
    remainingLarge: Math.max(0, MAX_L - usedL),
  };
}

// ---------------------- Helper: compute fare + fees ----------------------
function computeFareModel(ride, requests) {
  const estimatedFare = Number(ride.estimated_fare || 0);
  if (!estimatedFare || estimatedFare <= 0) {
    throw new Error("Ride has no valid estimated_fare");
  }

  const hostSeats = Number(ride.seats ?? 1);
  const passengerSeats = requests.reduce(
    (sum, r) => sum + Number(r.seats || 0),
    0
  );

  const totalSeats = hostSeats + passengerSeats;
  if (totalSeats <= 0) {
    throw new Error("No seats found for fare calculation");
  }

  const estimateMinor = Math.round(estimatedFare * 100); // £ → pence
  const seatShareMinor = Math.max(1, Math.round(estimateMinor / totalSeats)); // at least 1p

  const perRequest = [];
  let totalPassengerSeatMinor = 0;
  let totalPassengerPlatformMinor = 0;

  for (const req of requests) {
    const seats = Number(req.seats || 0);
    const seatAmountMinor = seatShareMinor * seats;

    // Platform fee per passenger:
    // - If their seat amount < £10 → flat £1
    // - Else → 12%
    let platformFeeMinor;
    if (seatAmountMinor < 1000) {
      platformFeeMinor = 100; // £1
    } else {
      platformFeeMinor = Math.round(seatAmountMinor * 0.12);
    }

    perRequest.push({
      request_id: req.id,
      user_id: req.user_id,
      seats,
      seat_amount_minor: seatAmountMinor,
      platform_fee_minor: platformFeeMinor,
      total_charge_minor: seatAmountMinor + platformFeeMinor,
    });

    totalPassengerSeatMinor += seatAmountMinor;
    totalPassengerPlatformMinor += platformFeeMinor;
  }

  // Host fee: 3% of passenger seat total
  const hostFeeMinor = Math.round(totalPassengerSeatMinor * 0.03);
  const hostPayoutMinor = totalPassengerSeatMinor - hostFeeMinor;
  const platformRevenueMinor = totalPassengerPlatformMinor + hostFeeMinor;

  return {
    seatShareMinor,
    perRequest,
    totals: {
      totalPassengerSeatMinor,
      totalPassengerPlatformMinor,
      hostFeeMinor,
      hostPayoutMinor,
      platformRevenueMinor,
    },
  };
}

/* ============================================================
   1. REQUEST TO JOIN RIDE
============================================================ */
router.post("/:rideId/request", express.json(), async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { luggage = {}, seats = 1 } = req.body;

    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // 1) Check ride exists & active
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, user_id, status")
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });

    if (ride.status !== "active")
      return res.status(400).json({ error: "Ride is not open for booking" });

    // 2) Prevent duplicates
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

    // 3) Compute live capacity
    const cap = await computeRemainingCapacity(rideId);

    // Convert luggage to integers
    const B = luggage.backpack || 0;
    const S = luggage.small || 0;
    const L = luggage.large || 0;

    // 4) Validate seat & luggage availability
    if (seats > cap.remainingSeats)
      return res.status(400).json({
        error: `Not enough seats. Remaining: ${cap.remainingSeats}`,
      });

    if (B > cap.remainingBackpacks)
      return res.status(400).json({
        error: `Backpack limit exceeded. Remaining: ${cap.remainingBackpacks}`,
      });

    if (S > cap.remainingSmall)
      return res.status(400).json({
        error: `Small suitcase limit exceeded. Remaining: ${cap.remainingSmall}`,
      });

    if (L > cap.remainingLarge)
      return res.status(400).json({
        error: `Large suitcase limit exceeded. Remaining: ${cap.remainingLarge}`,
      });

    // 5) Insert request
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
   2. GET LIVE CAPACITY (Frontend uses this)
============================================================ */
router.get("/:rideId/capacity", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const cap = await computeRemainingCapacity(rideId);
    return res.json({ ok: true, capacity: cap });
  } catch (err) {
    console.error("capacity error:", err);
    return res.status(500).json({ error: "Failed to load capacity" });
  }
});

/* ============================================================
   3. GET ALL REQUESTS FOR A RIDE (Host only)
============================================================ */
router.get("/:rideId/requests", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Check ride exists
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("user_id")
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });

    // Only host can view
    if (ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    // Load requests with profile info
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
        profiles ( nickname, avatar_url )
      `
      )
      .eq("ride_id", rideId)
      .order("created_at");

    if (reqErr) throw reqErr;

    return res.json({ ok: true, requests });
  } catch (err) {
    console.error("get requests error:", err);
    return res.status(500).json({ error: "Failed to load requests" });
  }
});
/* ============================================================
   4A. ACCEPT REQUEST (Host only)
============================================================ */
router.post("/:rideId/requests/:requestId/accept", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const requestId = Number(req.params.requestId);

    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Fetch ride + ensure host owns it
    const { data: ride } = await supabase
      .from("rides")
      .select("user_id, status")
      .eq("id", rideId)
      .single();

    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    if (ride.status !== "active")
      return res.status(400).json({ error: "Ride not open for booking" });

    // Fetch request
    const { data: request } = await supabase
      .from("ride_requests")
      .select("*")
      .eq("id", requestId)
      .eq("ride_id", rideId)
      .single();

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending")
      return res.status(400).json({ error: "Request already processed" });

    // Check capacity before accepting
    const cap = await computeRemainingCapacity(rideId);

    if (request.seats > cap.remainingSeats)
      return res.status(400).json({
        error: `Not enough seats left. Remaining: ${cap.remainingSeats}`,
      });

    if (request.luggage_small > cap.remainingSmall)
      return res.status(400).json({
        error: `Not enough small suitcase space. Remaining: ${cap.remainingSmall}`,
      });

    if (request.luggage_large > cap.remainingLarge)
      return res.status(400).json({
        error: `Not enough large suitcase space. Remaining: ${cap.remainingLarge}`,
      });

    // Accept it
    const { data: updated, error: updErr } = await supabase
      .from("ride_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .select()
      .single();

    if (updErr) throw updErr;

    return res.json({ ok: true, request: updated });
  } catch (err) {
    console.error("accept request error:", err);
    return res.status(500).json({ error: "Failed to accept request" });
  }
});
/* ============================================================
   4B. REJECT REQUEST (Host only)
============================================================ */
router.post("/:rideId/requests/:requestId/reject", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const requestId = Number(req.params.requestId);

    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Check ride & host
    const { data: ride } = await supabase
      .from("rides")
      .select("user_id")
      .eq("id", rideId)
      .single();

    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    // Check request
    const { data: request } = await supabase
      .from("ride_requests")
      .select("id, status")
      .eq("id", requestId)
      .eq("ride_id", rideId)
      .single();

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending")
      return res.status(400).json({ error: "Request already processed" });

    // Update status
    const { data: updated, error: updErr } = await supabase
      .from("ride_requests")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
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
   5. FINALISE RIDE (host locks in payouts & deposits)
============================================================ */
router.post("/:rideId/finalise", express.json(), async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // 1️⃣ Load ride & verify host
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, user_id, estimated_fare, seats")
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });

    if (ride.user_id !== user.id) {
      return res.status(403).json({ error: "Only the host can finalise" });
    }

    // 2️⃣ Prevent double-finalise (if deposits already exist)
    const { data: existingDeposits, error: depCheckErr } = await supabase
      .from("ride_deposits")
      .select("id")
      .eq("ride_id", rideId)
      .limit(1);

    if (depCheckErr) {
      console.error("deposit check error:", depCheckErr);
      return res
        .status(500)
        .json({ error: "Failed to check existing deposits" });
    }

    if (existingDeposits && existingDeposits.length > 0) {
      return res
        .status(400)
        .json({ error: "Ride already has deposits; maybe already finalised" });
    }

    // 3️⃣ Load accepted requests
    const { data: acceptedReqs, error: reqErr } = await supabase
      .from("ride_requests")
      .select("id, user_id, seats")
      .eq("ride_id", rideId)
      .eq("status", "accepted");

    if (reqErr) {
      console.error("load accepted requests error:", reqErr);
      return res.status(500).json({ error: "Failed to load ride requests" });
    }

    if (!acceptedReqs || acceptedReqs.length === 0) {
      return res
        .status(400)
        .json({ error: "No accepted requests to finalise" });
    }

    // 4️⃣ Compute fare model (seat share + platform + host fee)
    const fare = computeFareModel(ride, acceptedReqs);

    // 5️⃣ Insert deposits per request
    const depositRows = fare.perRequest.map((r) => ({
      ride_id: rideId,
      user_id: r.user_id,
      request_id: r.request_id,
      amount_minor: r.seat_amount_minor, // seat share
      platform_fee_minor: r.platform_fee_minor,
      currency: "gbp",
      status: "pending", // not yet paid
    }));

    const { data: insertedDeposits, error: depErr } = await supabase
      .from("ride_deposits")
      .insert(depositRows)
      .select("id, request_id, user_id, amount_minor, platform_fee_minor");

    if (depErr) {
      console.error("insert deposits error:", depErr);
      return res.status(500).json({ error: "Failed to create deposits" });
    }

    // 6️⃣ Create host payout stub
    const { totals } = fare;
    const { data: payoutRow, error: payoutErr } = await supabase
      .from("ride_payouts")
      .insert({
        ride_id: rideId,
        host_user_id: ride.user_id,
        currency: "gbp",
        total_seat_minor: totals.totalPassengerSeatMinor,
        host_fee_minor: totals.hostFeeMinor,
        host_payout_minor: totals.hostPayoutMinor,
        status: "pending",
      })
      .select()
      .single();

    if (payoutErr) {
      console.error("insert payout error:", payoutErr);
      return res.status(500).json({ error: "Failed to create host payout" });
    }

    // 7️⃣ Optionally update ride status
    await supabase
      .from("rides")
      .update({ status: "pending_payment" })
      .eq("id", rideId);

    return res.json({
      ok: true,
      seatShareMinor: fare.seatShareMinor,
      deposits: insertedDeposits,
      hostPayout: payoutRow,
      totals: fare.totals,
    });
  } catch (err) {
    console.error("finalise error:", err);
    return res.status(500).json({ error: "Failed to finalise ride" });
  }
});

export default router;
