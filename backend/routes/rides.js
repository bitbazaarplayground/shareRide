// backend/routes/rides.js
import express from "express";
import { getUserFromToken } from "../helpers/auth.js";
import { computeBookingStatus } from "../helpers/bookingStatus.js";
import { cancelRide } from "../helpers/cancelRide.js";
import { clamp, generateCode6 } from "../helpers/pricing.js";
import { buildUberDeepLink } from "../helpers/ridePool.js";
import { stripe } from "../helpers/stripe.js";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

/* ---------------------- Origin picker ---------------------- */
function getAppOrigin() {
  const ORIGINS = (process.env.APP_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === "production") {
    return ORIGINS.find((o) => o.includes("netlify.app")) || ORIGINS[0];
  }
  return ORIGINS.find((o) => o.includes("localhost")) || ORIGINS[0];
}

/* ---------------------- Create ride pool ---------------------- */
router.post("/:rideId/create-pool", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId } = req.body;

    if (!rideId || !userId) {
      return res.status(400).json({ error: "rideId and userId are required" });
    }

    // 1️⃣ Get ride details (including host’s declared usage)
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select(
        "id, user_id, status, seats, backpack_count, small_suitcase_count, large_suitcase_count, date, time"
      )
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });
    if (ride.status !== "active")
      return res.status(400).json({ error: "Ride is not active" });

    // 2️⃣ Check if pool already exists
    const { data: existingPool } = await supabase
      .from("ride_pools")
      .select("id")
      .eq("ride_id", rideId)
      .maybeSingle();

    if (existingPool) {
      return res.json({
        message: "✅ Ride pool already exists",
        poolId: existingPool.id,
      });
    }

    // 3️⃣ Calculate dynamic confirm_by time
    const rideDateTime = new Date(`${ride.date}T${ride.time}`);
    const now = new Date();
    const diffHours = (rideDateTime - now) / (1000 * 60 * 60);

    let confirmBy;

    // 🧭 Dynamic time window based on how soon the ride starts
    if (diffHours > 24) {
      confirmBy = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours
    } else if (diffHours > 12) {
      confirmBy = new Date(now.getTime() + 2.5 * 60 * 60 * 1000); // 2.5 hours
    } else if (diffHours > 4) {
      confirmBy = new Date(now.getTime() + 1 * 60 * 60 * 1000); // 1 hour
    } else {
      confirmBy = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    }

    // 🛡️ Safety fallback — never allow confirm_by beyond the ride time
    if (confirmBy > rideDateTime)
      confirmBy = new Date(rideDateTime.getTime() - 10 * 60 * 1000);

    // 4️⃣ Create new pool (with confirm_by)
    const { data: newPool, error: poolErr } = await supabase
      .from("ride_pools")
      .insert({
        ride_id: rideId,
        currency: "gbp",
        booker_user_id: ride.user_id || userId,
        status: "collecting",
        confirm_by: confirmBy.toISOString(),
      })
      .select("id")
      .single();

    if (poolErr) {
      console.error("❌ Failed to create ride pool:", poolErr);
      return res.status(500).json({ error: "Failed to create ride pool" });
    }

    // console.log(
    //   `✅ New ride pool ${newPool.id} created for ride ${rideId}. Host must confirm by ${confirmBy.toISOString()} (${(
    //     (confirmBy - now) /
    //     (1000 * 60)
    //   ).toFixed(0)} min from now)`
    // );

    // 5️⃣ Insert host contribution (baseline reservation)
    const { error: contribErr } = await supabase
      .from("ride_pool_contributions")
      .insert({
        ride_pool_id: newPool.id,
        user_id: ride.user_id,
        currency: "gbp",
        user_share_minor: 0,
        platform_fee_minor: 0,
        seats_reserved: Number(ride.seats ?? 1),
        backpacks_reserved: Number(ride.backpack_count ?? 0),
        small_reserved: Number(ride.small_suitcase_count ?? 0),
        large_reserved: Number(ride.large_suitcase_count ?? 0),
        status: "pending", // host has not paid yet
        is_host: true,
      });

    if (contribErr) {
      console.error("❌ Failed to insert host contribution:", contribErr);
      // Don’t fail the request, just warn
    }

    return res.json({
      message: "✅ Ride pool + host baseline created",
      poolId: newPool.id,
      confirmBy,
    });
  } catch (err) {
    console.error("❌ create-pool error:", err);
    return res.status(500).json({ error: "Failed to create ride pool" });
  }
});

/* ---------------------- Delete Ride ---------------------- */

router.delete("/:rideId", express.json(), async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Load ride + ownership
    const { data: ride, error: rErr } = await supabase
      .from("rides")
      .select("id, user_id")
      .eq("id", rideId)
      .single();
    if (rErr || !ride) return res.status(404).json({ error: "Ride not found" });

    if (ride.user_id !== user.id)
      return res.status(403).json({ error: "Not your ride" });

    // If a pool exists AND any contribution by someone else exists → block delete
    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, status")
      .eq("ride_id", rideId)
      .maybeSingle();

    if (pool) {
      const { data: others } = await supabase
        .from("ride_pool_contributions")
        .select("id")
        .eq("ride_pool_id", pool.id)
        .neq("user_id", user.id)
        .limit(1);
      if (others && others.length > 0) {
        return res
          .status(409)
          .json({ error: "Cannot delete: another user has joined" });
      }
    }

    // Delete (service role client bypasses RLS; FKs handle cascade)
    const { error: dErr } = await supabase
      .from("rides")
      .delete()
      .eq("id", rideId);
    if (dErr) return res.status(400).json({ error: dErr.message });

    return res.json({ ok: true });
  } catch (e) {
    console.error("delete ride error:", e);
    return res.status(500).json({ error: "Failed to delete ride" });
  }
});

/* ---------------------- Booking Status ---------------------- */

router.get("/:rideId/booking-status", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const userId = req.query.userId || null;
    // console.log("📡 booking-status request", { rideId, userId });
    const result = await computeBookingStatus(rideId, userId);
    res.json(result);
  } catch (e) {
    console.error("booking-status error:", e.stack || e);
    res.status(500).json({ error: "Failed to fetch booking status" });
  }
});

router.post("/booking-status/batch", async (req, res) => {
  try {
    const { rideIds, userId } = req.body;
    if (!Array.isArray(rideIds) || rideIds.length === 0) {
      return res.status(400).json({ error: "rideIds required" });
    }

    const results = {};
    for (const rideId of rideIds) {
      try {
        const result = await computeBookingStatus(rideId, userId);
        results[rideId] = result.status;
      } catch (err) {
        console.error(`Failed to compute status for ride ${rideId}:`, err);
        results[rideId] = null;
      }
    }

    res.json(results);
  } catch (e) {
    console.error("batch booking-status error:", e);
    res.status(500).json({ error: "Failed to fetch batch booking status" });
  }
});

/* ---------------------- Cancel Ride (with refunds + email notify) ---------------------- */

// Host cancel
router.post("/:rideId/cancel", express.json(), async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);

    // ✅ Auth via helper
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // ✅ Load ride from DB
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, user_id")
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });

    // 🔎 Normalize IDs before comparing
    const rideUserId = (ride.user_id || "").toString().trim();
    const tokenUserId = (user.id || "").toString().trim();

    console.log("===== CANCEL DEBUG =====");
    console.log("Ride.user_id (raw):", ride.user_id);
    console.log("Token user.id (raw):", user.id);
    console.log("🔎 Normalized rideUserId:", JSON.stringify(rideUserId));
    console.log("🔎 Normalized tokenUserId:", JSON.stringify(tokenUserId));
    console.log("Equality check:", rideUserId === tokenUserId);

    // ✅ Ensure ownership
    if (rideUserId !== tokenUserId) {
      return res.status(403).json({
        error: "Not your ride",
        rideUserId,
        tokenUserId,
      });
    }

    // ✅ Call shared cancel helper (refunds + emails handled inside cancelRide.js)
    const result = await cancelRide(rideId, {
      isAdmin: false,
      userId: user.id,
      canceledBy: user.email,
    });

    return res.json(result);
  } catch (err) {
    console.error("Host cancel error:", err.message);
    res.status(500).json({ error: "Host cancel failed" });
  }
});

/* ---------------------- Lock seat ---------------------- */
router.post("/:rideId/lock-seat", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // ===== Ensure pool exists =====
    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, currency, status")
      .eq("ride_id", rideId)
      .maybeSingle();

    if (!pool) return res.status(404).json({ error: "Ride pool not found" });

    // ✅ Allow locking seats if pool is still open or confirmed
    if (!["collecting", "bookable", "confirmed"].includes(pool.status)) {
      return res
        .status(400)
        .json({ error: "This ride is no longer accepting new bookings" });
    }

    // ===== Upsert or refresh contribution lock =====
    const { data: contrib, error: contribErr } = await supabase
      .from("ride_pool_contributions")
      .upsert(
        {
          ride_pool_id: pool.id,
          user_id: user.id,
          currency: pool.currency || "gbp",
          user_share_minor: 0,
          platform_fee_minor: 0,
          seats_reserved: 0,
          backpacks_reserved: 0,
          small_reserved: 0,
          large_reserved: 0,
          status: "pending",
          is_host: false,
          created_at: new Date().toISOString(), // reset lock timer
        },
        { onConflict: "ride_pool_id,user_id" }
      )
      .select("id, created_at")
      .single();

    if (contribErr || !contrib) {
      console.error("❌ lock-seat upsert error:", contribErr);
      return res.status(500).json({ error: "Could not create contribution" });
    }

    // ===== 5-minute expiry =====
    const EXP_MS = 5 * 60 * 1000;
    const expiresAt = new Date(
      new Date(contrib.created_at).getTime() + EXP_MS
    ).toISOString();

    return res.json({ contributionId: contrib.id, expiresAt });
  } catch (err) {
    console.error("❌ lock-seat error (full):", err);
    return res.status(500).json({ error: "Failed to lock seat" });
  }
});
/* ---------------------- Cleanup Expired Seat Locks ---------------------- */
router.post("/cleanup-expired-locks", async (req, res) => {
  try {
    // 🔒 Verify secret
    const authHeader = req.headers.authorization || "";
    const providedSecret = authHeader.replace("Bearer ", "").trim();

    if (!providedSecret || providedSecret !== process.env.CRON_SECRET) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const nowIso = new Date().toISOString();

    // Delete any expired seat locks
    const { error: delErr, count } = await supabase
      .from("ride_locks")
      .delete({ count: "exact" })
      .lt("expires_at", nowIso);

    if (delErr) throw delErr;

    console.log(`🧹 Released ${count || 0} expired seat locks`);
    return res.json({ released: count || 0 });
  } catch (err) {
    console.error("cleanup-expired-locks failed:", err);
    return res.status(500).json({ error: "Failed to clean up expired locks" });
  }
});

/* ---------------------- Issue check-in code (booker only) ---------------------- */
router.post("/:rideId/issue-code", express.json(), async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);

    // Validate body
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({ error: "Missing or invalid JSON body" });
    }

    const { userId, ttlSeconds = 600 } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId in request body" });
    }

    // Load pool
    const { data: pool, error: poolErr } = await supabase
      .from("ride_pools")
      .select("id, booker_user_id, status")
      .eq("ride_id", rideId)
      .maybeSingle();

    if (poolErr) {
      console.error("Supabase pool error:", poolErr.message);
      return res
        .status(500)
        .json({ error: "Database error while fetching pool" });
    }
    if (!pool) return res.status(404).json({ error: "Pool not found" });

    // Must be the booker
    if (pool.booker_user_id !== userId) {
      return res.status(403).json({ error: "Only the booker can issue code" });
    }

    // Pool must be in the right state
    if (!["bookable", "checking_in"].includes(pool.status)) {
      return res
        .status(400)
        .json({ error: `Pool not ready for check-in (status=${pool.status})` });
    }

    // Generate code & expiry
    const code = generateCode6();
    const ttl = clamp(Number(ttlSeconds), 120, 1800); // 2–30 min
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + ttl * 1000).toISOString();

    const { error: updErr } = await supabase
      .from("ride_pools")
      .update({
        booking_code: code,
        code_expires_at: expiresAt,
        code_issued_at: issuedAt.toISOString(),
        status: "checking_in",
      })
      .eq("id", pool.id);

    if (updErr) {
      console.error("Supabase update error:", updErr.message);
      return res.status(500).json({ error: "Failed to update pool with code" });
    }

    return res.json({ code, expiresAt });
  } catch (e) {
    console.error("issue-code error:", e);
    res.status(500).json({ error: "Failed to issue code" });
  }
});

/* ---------------------- Claim booker ---------------------- */
router.post("/:rideId/claim-booker", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId, graceSeconds = 180 } = req.body;

    // Load pool
    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, status, booker_user_id, code_issued_at, min_contributors")
      .eq("ride_id", rideId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found" });

    // Pool must be in check-in or ready state
    if (!["checking_in", "ready_to_book"].includes(pool.status)) {
      return res.status(400).json({ error: "Pool not in a claimable state" });
    }

    // Check if code was issued
    const issuedAt = pool.code_issued_at ? new Date(pool.code_issued_at) : null;
    if (!issuedAt)
      return res.status(400).json({ error: "No active check-in session" });

    // Grace period before takeover allowed
    const grace = clamp(Number(graceSeconds), 60, 600);
    const claimNotBefore = new Date(issuedAt.getTime() + grace * 1000);
    if (new Date() < claimNotBefore) {
      return res.status(400).json({
        error: "Too early to claim booker",
        claimAllowedAt: claimNotBefore.toISOString(),
      });
    }

    // Was original booker checked in?
    const { data: origBookerContrib } = await supabase
      .from("ride_pool_contributions")
      .select("id, checked_in_at")
      .eq("ride_pool_id", pool.id)
      .eq("user_id", pool.booker_user_id)
      .eq("status", "paid")
      .maybeSingle();

    if (origBookerContrib?.checked_in_at) {
      return res.status(409).json({ error: "Original booker is present" });
    }

    // Claimant must be PAID + CHECKED-IN
    const { data: claimant } = await supabase
      .from("ride_pool_contributions")
      .select("id, checked_in_at")
      .eq("ride_pool_id", pool.id)
      .eq("user_id", userId)
      .eq("status", "paid")
      .single();

    if (!claimant || !claimant.checked_in_at) {
      return res
        .status(403)
        .json({ error: "Only checked-in contributors can claim" });
    }

    // Check quorum
    const { data: paidRows } = await supabase
      .from("ride_pool_contributions")
      .select("id, checked_in_at")
      .eq("ride_pool_id", pool.id)
      .eq("status", "paid");

    const checkedInCount = (paidRows || []).filter(
      (r) => !!r.checked_in_at
    ).length;
    const required = pool.min_contributors || 2;

    if (checkedInCount < required) {
      return res.status(400).json({
        error: "Not enough checked-in contributors to reassign",
        checkedInCount,
        required,
      });
    }

    // Reassign booker
    await supabase
      .from("ride_pools")
      .update({ booker_user_id: userId, status: "ready_to_book" })
      .eq("id", pool.id);

    res.json({ ok: true, newBookerUserId: userId });
  } catch (e) {
    console.error("claim-booker error:", e);
    res.status(500).json({ error: "Failed to claim booker" });
  }
});

/* ---------------------- Check-in with code ---------------------- */
router.post("/:rideId/check-in", express.json(), async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId, code, lat = null, lng = null } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ error: "Missing userId or code" });
    }

    // Load pool and verify code
    const { data: pool, error: poolErr } = await supabase
      .from("ride_pools")
      .select("id, booking_code, code_expires_at, status")
      .eq("ride_id", rideId)
      .single();

    if (poolErr || !pool)
      return res.status(404).json({ error: "Ride pool not found" });

    if (pool.booking_code !== code)
      return res.status(400).json({ error: "Invalid code" });

    if (new Date() > new Date(pool.code_expires_at))
      return res.status(400).json({ error: "Code expired" });

    // Mark user as checked in
    const { error: updErr } = await supabase
      .from("ride_pool_contributions")
      .update({
        checked_in_at: new Date().toISOString(),
        checkin_lat: lat,
        checkin_lng: lng,
      })
      .eq("ride_pool_id", pool.id)
      .eq("user_id", userId)
      .eq("status", "paid");

    if (updErr) {
      console.error("check-in update error:", updErr);
      return res.status(500).json({ error: "Failed to mark check-in" });
    }

    // Optional: count how many have checked in
    const { data: contribs } = await supabase
      .from("ride_pool_contributions")
      .select("id, checked_in_at, status")
      .eq("ride_pool_id", pool.id);

    const checkedInCount = (contribs || []).filter(
      (c) => c.status === "paid" && !!c.checked_in_at
    ).length;

    return res.json({ ok: true, checkedInCount, required: 2 });
  } catch (e) {
    console.error("check-in error:", e);
    res.status(500).json({ error: "Failed to check in" });
  }
});

/* ---------------------- Booker: get Uber deep link ---------------------- */
router.get("/:rideId/uber-link", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const userId = req.query.userId;

    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, status, booker_user_id")
      .eq("ride_id", rideId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found" });
    if (pool.booker_user_id !== userId)
      return res.status(403).json({ error: "Only booker can open Uber" });
    if (pool.status !== "ready_to_book") {
      return res.status(400).json({ error: "Not ready to book yet" });
    }

    const { data: ride } = await supabase
      .from("rides")
      .select("from, to, from_lat, from_lng, to_lat, to_lng, date, time")
      .eq("id", rideId)
      .single();

    const url = buildUberDeepLink(ride);
    await supabase
      .from("ride_pools")
      .update({ status: "booking" })
      .eq("id", pool.id);

    res.json({ url });
  } catch (e) {
    console.error("uber-link error:", e);
    res.status(500).json({ error: "Failed to build Uber link" });
  }
});

/* ---------------------- Reimburse booker (Connect) ---------------------- */
router.post("/:rideId/confirm-booked", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId } = req.body;

    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, status, booker_user_id, currency")
      .eq("ride_id", rideId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found" });
    if (pool.booker_user_id !== userId)
      return res.status(403).json({ error: "Only booker can confirm" });
    if (!["bookable", "ready_to_book", "booking"].includes(pool.status)) {
      return res.status(400).json({ error: "Pool not ready to payout" });
    }

    // Compute collected total (user shares only)
    const { data: contribs } = await supabase
      .from("ride_pool_contributions")
      .select("user_share_minor, status")
      .eq("ride_pool_id", pool.id);

    const totalUserShareMinor = (contribs || [])
      .filter((c) => c.status === "paid")
      .reduce((s, c) => s + (c.user_share_minor || 0), 0);
    if (!totalUserShareMinor || totalUserShareMinor < 50) {
      return res.status(400).json({ error: "Insufficient collected funds" });
    }

    const { data: prof } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarded")
      .eq("id", pool.booker_user_id)
      .single();
    if (!prof?.stripe_connect_account_id || !prof?.stripe_connect_onboarded) {
      return res.status(400).json({ error: "Booker not onboarded" });
    }

    const transfer = await stripe.transfers.create({
      amount: totalUserShareMinor,
      currency: pool.currency || "gbp",
      destination: prof.stripe_connect_account_id,
      transfer_group: `ride_${rideId}`,
    });

    await supabase.from("booker_payouts").insert({
      ride_id: rideId,
      booker_user_id: pool.booker_user_id,
      connected_account_id: prof.stripe_connect_account_id,
      transfer_id: transfer.id,
      amount_minor: totalUserShareMinor,
      status: "transferred",
    });

    await supabase
      .from("ride_pools")
      .update({ status: "booked" })
      .eq("id", pool.id);
    res.json({
      ok: true,
      transferId: transfer.id,
      amount_minor: totalUserShareMinor,
    });
  } catch (e) {
    console.error("confirm-booked error:", e);
    res.status(500).json({ error: "Failed to transfer funds" });
  }
});
/* ---------------------- Postman testing ---------------------- */
router.post("/", express.json(), async (req, res) => {
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const {
      from,
      to,
      date,
      time,
      vehicle_type,
      seats,
      backpack_count,
      small_suitcase_count,
      large_suitcase_count,
      estimated_fare,
    } = req.body;

    const { data, error } = await supabase
      .from("rides")
      .insert({
        user_id: user.id,
        from,
        to,
        date,
        time,
        vehicle_type,
        seats,
        backpack_count,
        small_suitcase_count,
        large_suitcase_count,
        estimated_fare,
      })
      .select("id")
      .single();

    if (error) return res.status(400).json({ error: error.message });

    res.json({ ok: true, rideId: data.id });
  } catch (err) {
    console.error("Create ride error:", err);
    res.status(500).json({ error: "Failed to create ride" });
  }
});
export default router;
