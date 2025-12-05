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
    if (!ride?.date || !ride?.time) return false;

    // Parse in LOCAL TIME instead of UTC
    const [hh, mm] = ride.time.split(":").map(Number);
    const [y, m, d] = ride.date.split("-").map(Number);

    const rideDateTime = new Date(y, m - 1, d, hh, mm, 0); // LOCAL TIME
    const now = new Date();

    const diffMinutes = (rideDateTime.getTime() - now.getTime()) / 60000;

    console.log("AUTO-CLOSE CHECK:", {
      rideId: ride.id,
      rideDateTime: rideDateTime.toString(),
      now: now.toString(),
      diffMinutes,
      status: ride.status,
    });

    // Only auto-close if truly within the last 5 minutes before the ride
    if (diffMinutes <= 5 && diffMinutes >= -5 && ride.status === "active") {
      await supabase
        .from("rides")
        .update({ status: "closed_to_requests" })
        .eq("id", ride.id);

      console.log("AUTO-CLOSE: Ride closed because within 5 min window.");
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
  // Load ride with CORRECT fields based on your DB schema
  const { data: ride, error: rideErr } = await supabase
    .from("rides")
    .select("seats, max_small_suitcases, max_large_suitcases")
    .eq("id", rideId)
    .single();

  if (rideErr || !ride) throw new Error("Ride not found");

  // Host usage
  const hostSeats = ride.seats ?? 1;
  const hostS = ride.max_small_suitcases ?? 0;
  const hostL = ride.max_large_suitcases ?? 0;

  // Load all accepted passenger requests
  const { data: requests, error: reqErr } = await supabase
    .from("ride_requests")
    .select("seats, luggage_small, luggage_large")
    .eq("ride_id", rideId)
    .eq("status", "accepted");

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
          `
        id,
        request_id,
        user_id,
        amount_minor,
        platform_fee_minor,
        currency,
        status,
        payment_intent_id,
        checkin_code,
        checkin_code_expires_at,
        checked_in_at
      `
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
        `id, user_id, seats, luggage_small, luggage_large,
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

    /* ---------------------------------------------
   Load request safely (avoid `.single()` crash)
--------------------------------------------- */
    const { data: request, error: reqErr } = await supabase
      .from("ride_requests")
      .select("*")
      .eq("id", requestId)
      .eq("ride_id", rideId)
      .maybeSingle(); // ← SAFE VERSION

    if (reqErr) {
      console.error("REQUEST LOAD ERROR:", reqErr);
      return res.status(500).json({ error: "Failed to load request" });
    }

    if (!request) {
      console.error("REQUEST NOT FOUND:", { rideId, requestId });
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.status !== "pending")
      return res.status(400).json({ error: "Request already processed" });

    // Compute current remaining capacity
    const cap = await computeRemainingCapacity(rideId);

    // Validate capacity
    if (request.seats > cap.remainingSeats) {
      return res.status(400).json({ error: "Not enough seats" });
    }

    if ((request.luggage_small || 0) > cap.remainingSmall) {
      return res.status(400).json({ error: "Not enough small suitcase space" });
    }

    if ((request.luggage_large || 0) > cap.remainingLarge) {
      return res.status(400).json({ error: "Not enough large suitcase space" });
    }

    // Accept request
    const { data: updatedReq, error: updErr } = await supabase
      .from("ride_requests")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .select()
      .maybeSingle();

    console.log("UPDATE RESULT:", { updatedReq, updErr });

    if (updErr) throw updErr;

    // FARE AND FEES
    // convert estimated fare (host estimate) to integer minor units
    const totalFareMinor = Math.round(Number(ride.estimated_fare) * 100);

    // blablacar pricing: fixed 4-way split
    const seatMinor = Math.round(totalFareMinor / 4);

    // platform fee (10%)
    const platformFeeMinorPerSeat = Math.round(seatMinor * 0.1);

    // compute totals
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
   8. Passenger GET deposits (UPDATED FOR CHECK-IN CODES)
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
        checkin_code,
        checkin_code_expires_at,
        checked_in_at,
        rides (*),
        ride_requests (*)
      `
      )
      .eq("user_id", user.id);

    if (error) {
      console.error("load my deposits error:", error);
      return res.status(500).json({ error: "Failed to load deposits" });
    }

    return res.json({ ok: true, deposits: data || [] });
  } catch (err) {
    console.error("my deposits error:", err);
    return res.status(500).json({ error: "Failed to load deposits" });
  }
});

/* ============================================================
   9. EDIT RIDE (Host only, safe rules)
   PATCH /api/rides-new/:rideId
============================================================ */
router.patch("/:rideId", express.json(), async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const updates = req.body;

    const user = await getUserFromToken(req.headers.authorization);
    if (!user)
      return res.status(401).json({ ok: false, error: "Unauthorized" });

    /* -----------------------------
       1) Load ride
    ------------------------------ */
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ ok: false, error: "Ride not found" });

    if (ride.user_id !== user.id)
      return res.status(403).json({ ok: false, error: "Not your ride" });

    /* -----------------------------
       2) Prevent editing <24 hours
    ------------------------------ */
    const now = new Date();
    const rideDateTime = new Date(`${ride.date}T${ride.time}:00`);
    const hoursDiff = (rideDateTime - now) / (1000 * 60 * 60);

    if (hoursDiff <= 24) {
      return res.status(400).json({
        ok: false,
        error: "You cannot edit a ride within 24 hours of departure.",
      });
    }

    /* -----------------------------
       3) Prevent editing if there are 
          accepted or paid passengers
    ------------------------------ */

    const { data: requests } = await supabase
      .from("ride_requests")
      .select("status")
      .eq("ride_id", rideId);

    const { data: deposits } = await supabase
      .from("ride_deposits")
      .select("status")
      .eq("ride_id", rideId);

    const hasAccepted = requests?.some((r) => r.status === "accepted");
    const hasPaid = deposits?.some((d) => d.status === "paid");

    if (hasAccepted || hasPaid) {
      return res.status(400).json({
        ok: false,
        error:
          "This ride cannot be edited because a passenger has already been accepted or paid.",
      });
    }

    /* -----------------------------
       4) Prevent editing seats
    ------------------------------ */
    if ("seats" in updates && updates.seats !== ride.seats) {
      return res.status(400).json({
        ok: false,
        error: "Host seat count cannot be edited.",
      });
    }

    /* -----------------------------
       5) Allowed fields only
    ------------------------------ */
    const allowed = [
      "from",
      "to",
      "date",
      "time",
      "estimated_fare",
      "notes",
      "small_suitcase_count",
      "large_suitcase_count",
    ];

    const safeUpdates = {};
    for (const key of allowed) {
      if (key in updates) safeUpdates[key] = updates[key];
    }

    if (Object.keys(safeUpdates).length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "No valid fields to update." });
    }

    /* -----------------------------
       6) Apply update
    ------------------------------ */
    const { data: updatedRide, error: updateErr } = await supabase
      .from("rides")
      .update(safeUpdates)
      .eq("id", rideId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return res.json({ ok: true, ride: updatedRide });
  } catch (err) {
    console.error("edit ride error:", err);
    return res.status(500).json({ ok: false, error: "Failed to edit ride." });
  }
});

/* ============================================================
   9. DELETE RIDE (Host Only) — Final Step 4 Logic
   - Handles 24h policy
   - Handles <10 min creation soft-deletion
   - Prevents deleting paid/accepted rides without warning
   - Cancels requests properly
   - Marks ride as cancelled (never physically deletes old rides)
============================================================ */
router.delete("/:rideId", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const user = await getUserFromToken(req.headers.authorization);

    if (!user)
      return res.status(401).json({ ok: false, error: "Unauthorized" });

    /* -----------------------------
       1) Load Ride & Host Check
    ------------------------------ */
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, user_id, created_at, date, time, status")
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ ok: false, error: "Ride not found" });

    if (ride.user_id !== user.id)
      return res.status(403).json({ ok: false, error: "Not your ride" });

    /* -----------------------------
       2) Check ride creation age
       - If ride < 10 minutes old
       - FULL DELETE allowed (test rides)
    ------------------------------ */
    const createdAt = new Date(ride.created_at);
    const now = new Date();
    const ageMinutes = (now - createdAt) / 60000;

    const isTestRide = ageMinutes < 10;

    /* -----------------------------
       3) Load Requests & Deposits
    ------------------------------ */
    const { data: requests } = await supabase
      .from("ride_requests")
      .select("id, status")
      .eq("ride_id", rideId);

    const { data: deposits } = await supabase
      .from("ride_deposits")
      .select("id, status, amount_minor, platform_fee_minor, user_id")
      .eq("ride_id", rideId);

    const hasAccepted = requests?.some((r) => r.status === "accepted");
    const hasPaid = deposits?.some((d) => d.status === "paid");
    const hasPendingDeposits = deposits?.some((d) => d.status === "pending");

    /* -----------------------------
       4) Allow full deletion for
          test rides (<10 minutes)
    ------------------------------ */
    if (isTestRide && !hasAccepted && !hasPaid) {
      // Delete all requests
      await supabase.from("ride_requests").delete().eq("ride_id", rideId);

      // Delete ride fully
      await supabase.from("rides").delete().eq("id", rideId);

      return res.json({
        ok: true,
        message: "Ride deleted (test mode).",
      });
    }

    /* -----------------------------
       5) 24-hour lock rule
       - We ALLOW cancellation even <24h
       - BUT frontend must show warning message
       (This endpoint still allows deletion)
    ------------------------------ */
    const rideDateTime = new Date(`${ride.date}T${ride.time}:00`);
    const hoursDiff = (rideDateTime - now) / (1000 * 60 * 60);
    const isWithin24h = hoursDiff <= 24;

    // (We do NOT block cancellation here, because your policy says allow.)

    /* -----------------------------
       6) Process cancellation
       - Accepted passengers exist
         → must refund / notify / strike host later
       - Pending deposits → cancel them
    ------------------------------ */

    /* --- 6A: Handle paid deposits --- */
    if (hasPaid) {
      // Refund logic stub (to implement in payout system)
      // For now, we ONLY block deletion if refund system not built.
      // But your policy says ALLOW cancellation even with paid users.

      // Mark deposits as refunded (temporary state)
      await supabase
        .from("ride_deposits")
        .update({ status: "refunded_by_host" })
        .eq("ride_id", rideId);

      // TODO: In Phase 3 — trigger Stripe refunds properly
    }

    /* --- 6B: Cancel pending deposits --- */
    if (hasPendingDeposits) {
      await supabase
        .from("ride_deposits")
        .update({ status: "cancelled" })
        .eq("ride_id", rideId)
        .eq("status", "pending");
    }

    /* --- 6C: Cancel requests --- */
    await supabase
      .from("ride_requests")
      .update({ status: "cancelled_by_host" })
      .eq("ride_id", rideId);

    /* -----------------------------
       7) Update ride status
    ------------------------------ */
    await supabase
      .from("rides")
      .update({ status: "cancelled" })
      .eq("id", rideId);

    /* -----------------------------
       8) Log host strike (future feature)
    ------------------------------ */
    // TODO: reliability system
    // Insert strike: cancellations_with_passengers++

    /* -----------------------------
       9) Notify passengers (Phase 4)
    ------------------------------ */
    // TODO: Send emails + in-app notifications

    return res.json({
      ok: true,
      message:
        "Ride cancelled. All passengers will be notified and refunded where necessary.",
    });
  } catch (err) {
    console.error("delete ride error:", err);
    return res.status(500).json({ ok: false, error: "Failed to delete ride." });
  }
});
/* ============================================================
   9. Passenger check-in (kept but simplified)
============================================================ */
/* ============================================================
   CHECK-IN PASSENGER WITH UNIQUE CODE (Host only)
============================================================ */
router.post("/:rideId/check-in", express.json(), async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { requestId, code } = req.body;

    // 1️⃣ Basic input validation
    if (!requestId || !code) {
      return res.status(400).json({ error: "Missing requestId or code" });
    }

    // 2️⃣ Authenticate user and confirm host permissions
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, user_id, status")
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });

    if (ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    // 3️⃣ Load passenger request (must be accepted)
    const { data: request, error: reqErr } = await supabase
      .from("ride_requests")
      .select("id, user_id, seats, status, checked_in")
      .eq("id", requestId)
      .eq("ride_id", rideId)
      .single();

    if (reqErr || !request)
      return res.status(404).json({ error: "Request not found" });

    if (request.status !== "accepted") {
      return res.status(400).json({ error: "Passenger not accepted yet" });
    }

    // 4️⃣ Load deposit (must exist + be paid)
    const { data: deposit, error: depErr } = await supabase
      .from("ride_deposits")
      .select(
        "id, status, checkin_code, checkin_code_expires_at, checked_in_at"
      )
      .eq("request_id", requestId)
      .eq("ride_id", rideId)
      .maybeSingle();

    if (depErr || !deposit)
      return res.status(400).json({ error: "Deposit not found" });

    if (deposit.status !== "paid") {
      return res.status(400).json({ error: "Passenger has not paid" });
    }

    if (deposit.checked_in_at) {
      return res.status(400).json({ error: "Passenger already checked in" });
    }

    // 5️⃣ Validate check-in code
    if (!deposit.checkin_code)
      return res.status(400).json({ error: "No check-in code assigned" });

    if (deposit.checkin_code !== code.trim().toUpperCase()) {
      return res.status(400).json({ error: "Invalid check-in code" });
    }

    // 6️⃣ Ensure code has not expired
    if (deposit.checkin_code_expires_at) {
      const expiresAt = new Date(deposit.checkin_code_expires_at).getTime();
      if (Date.now() > expiresAt) {
        return res.status(400).json({ error: "Check-in code has expired" });
      }
    }

    // 7️⃣ Mark passenger as checked in (write timestamp)
    const nowIso = new Date().toISOString();

    const { error: checkErr } = await supabase
      .from("ride_deposits")
      .update({ checked_in_at: nowIso })
      .eq("id", deposit.id);

    if (checkErr) throw checkErr;

    // 8️⃣ NEW — Update ride_requests.checked_in = true
    await supabase
      .from("ride_requests")
      .update({ checked_in: true })
      .eq("id", requestId);

    // 9️⃣ NEW — Evaluate if ALL accepted + paid passengers are now checked in
    //     If yes → set ride → ready_for_payout & upsert payout row
    await evaluatePayoutReadiness(rideId);

    // 🔟 Count checked-in passengers for UI feedback
    const { data: allDeposits } = await supabase
      .from("ride_deposits")
      .select("status, checked_in_at")
      .eq("ride_id", rideId)
      .eq("status", "paid");

    const totalPaid = allDeposits.length;
    const checkedInCount = allDeposits.filter((d) => d.checked_in_at).length;

    // 1️⃣1️⃣ Respond success
    return res.json({
      ok: true,
      message: "Passenger checked in successfully",
      checkedInCount,
      totalPaid,
    });
  } catch (err) {
    console.error("check-in error:", err);
    return res.status(500).json({ error: "Failed to check in passenger" });
  }
});

export default router;
