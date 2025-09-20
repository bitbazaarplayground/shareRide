// backend/routes/rides.js
import express from "express";
import { getUserFromToken, supabase } from "../helpers/auth.js";
import { getVehicleCapacity } from "../helpers/capacity.js";
import { clamp, generateCode6, toMinor } from "../helpers/pricing.js";
import { buildUberDeepLink } from "../helpers/ridePool.js";
import { stripe } from "../helpers/stripe.js";

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

    // Get ride details (including host’s declared usage)
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select(
        "id, user_id, status, seats, backpack_count, small_suitcase_count, large_suitcase_count"
      )
      .eq("id", rideId)
      .single();
    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });
    if (ride.status !== "active")
      return res.status(400).json({ error: "Ride is not active" });

    // Check if pool already exists
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

    // Create new pool
    const { data: newPool, error: poolErr } = await supabase
      .from("ride_pools")
      .insert({
        ride_id: rideId,
        currency: "gbp",
        booker_user_id: ride.user_id || userId,
        status: "collecting",
      })
      .select("id")
      .single();
    if (poolErr)
      return res.status(500).json({ error: "Failed to create ride pool" });

    // Insert host contribution (baseline reservation)
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
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: "Invalid token" });

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

/* ---------------------- Booking status (for UI) ---------------------- */
router.get("/:rideId/booking-status", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const userId = req.query.userId || null;

    // Load pool
    let { data: pool } = await supabase
      .from("ride_pools")
      .select(
        "id, status, currency, min_contributors, " +
          "total_reserved_seats, total_reserved_backpacks, total_reserved_small, total_reserved_large, " +
          "total_collected_user_share_minor, total_collected_platform_fee_minor, " +
          "booker_user_id, booking_code, code_expires_at, code_issued_at"
      )
      .eq("ride_id", rideId)
      .maybeSingle();

    if (!pool) {
      // Auto-create pool if missing
      const { data: rideData } = await supabase
        .from("rides")
        .select(
          "user_id, seats, backpack_count, small_suitcase_count, large_suitcase_count"
        )
        .eq("id", rideId)
        .single();
      if (!rideData?.user_id)
        return res.status(500).json({ error: "Ride not found" });

      const { data: newPool } = await supabase
        .from("ride_pools")
        .insert({
          ride_id: rideId,
          currency: "gbp",
          booker_user_id: rideData.user_id,
          status: "collecting",
        })
        .select("*")
        .single();
      pool = newPool;

      // Insert host contribution baseline if missing
      await supabase.from("ride_pool_contributions").insert({
        ride_pool_id: pool.id,
        user_id: rideData.user_id,
        currency: "gbp",
        user_share_minor: 0,
        platform_fee_minor: 0,
        seats_reserved: Number(rideData.seats ?? 1),
        backpacks_reserved: Number(rideData.backpack_count ?? 0),
        small_reserved: Number(rideData.small_suitcase_count ?? 0),
        large_reserved: Number(rideData.large_suitcase_count ?? 0),
        status: "pending",
        is_host: true,
      });
    }

    // Ride + vehicle capacity
    const { data: ride } = await supabase
      .from("rides")
      .select(
        "vehicle_type, seat_limit, seats, backpack_count, small_suitcase_count, large_suitcase_count, luggage_limit, estimated_fare"
      )
      .eq("id", rideId)
      .single();

    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const {
      seat: seatCap,
      backpack: bCap,
      small: sCap,
      large: lCap,
    } = getVehicleCapacity(ride.vehicle_type);

    // Already paid contributions
    const { data: paidRows } = await supabase
      .from("ride_pool_contributions")
      .select(
        "user_id, seats_reserved, checked_in_at, is_host, backpacks_reserved, small_reserved, large_reserved"
      )
      .eq("ride_pool_id", pool.id)
      .eq("status", "paid");

    const paidSeats = (paidRows || []).reduce(
      (sum, r) => sum + (Number(r.seats_reserved) || 0),
      0
    );
    const paidB = (paidRows || []).reduce(
      (sum, r) => sum + (Number(r.backpacks_reserved) || 0),
      0
    );
    const paidS = (paidRows || []).reduce(
      (sum, r) => sum + (Number(r.small_reserved) || 0),
      0
    );
    const paidL = (paidRows || []).reduce(
      (sum, r) => sum + (Number(r.large_reserved) || 0),
      0
    );

    // Host baseline (always reserved)
    const hostSeats = Number(ride?.seats ?? 1);
    const hostB = Number(ride?.backpack_count ?? 0);
    const hostS = Number(ride?.small_suitcase_count ?? 0);
    const hostL = Number(ride?.large_suitcase_count ?? 0);

    // Remaining after host + paid
    const remainingSeats = Math.max(seatCap - (hostSeats + paidSeats), 0);
    const rB = Math.max(0, bCap - (hostB + paidB));
    const rS = Math.max(0, sCap - (hostS + paidS));
    const rL = Math.max(0, lCap - (hostL + paidL));

    // total luggage mode fallback
    const totalCap = Number(ride?.luggage_limit ?? 0);
    const rTotal =
      totalCap > 0
        ? Math.max(
            0,
            totalCap - (hostB + hostS + hostL + paidB + paidS + paidL)
          )
        : 0;

    const luggageObj =
      bCap > 0 || sCap > 0 || lCap > 0
        ? {
            mode: "byKind",
            byKind: {
              backpacks: { limit: bCap, remaining: rB },
              small: { limit: sCap, remaining: rS },
              large: { limit: lCap, remaining: rL },
            },
            total: { limit: 0, remaining: 0 },
          }
        : totalCap > 0
          ? {
              mode: "total",
              byKind: {},
              total: { limit: totalCap, remaining: rTotal },
            }
          : { mode: "none", byKind: {}, total: { limit: 0, remaining: 0 } };

    const estimateMinor = toMinor(Number(ride?.estimated_fare ?? 35));
    const groupSize = Math.max(hostSeats + paidSeats, 1); // without the *current* user
    const perSeatMinor = Math.max(1, Math.round(estimateMinor / groupSize));
    const checkedInCount = (paidRows || []).filter(
      (r) => !!r.checked_in_at
    ).length;

    const required = pool.min_contributors || 2;
    const quorumMet = checkedInCount >= required;

    res.json({
      exists: true,
      capacity: {
        seats: { limit: seatCap },
        luggage: luggageObj,
      },
      paidSeats,
      remainingSeats,
      estimateMinor,
      perSeatMinor,
      // Booking code info
      codeActive: !!(
        pool.booking_code &&
        pool.code_expires_at &&
        new Date(pool.code_expires_at) > new Date()
      ),
      codeIssuedAt: pool.code_issued_at,
      codeExpiresAt: pool.code_expires_at,
      checkedInCount,
      required: pool.min_contributors || 2,
      quorumMet,
      status: pool.status,
      isBooker: userId && pool.booker_user_id === userId,
    });
  } catch (e) {
    console.error("booking-status error:", e);
    res.status(500).json({ error: "Failed to fetch booking status" });
  }
});

/* ---------------------- Lock seat ---------------------- */
router.post("/:rideId/lock-seat", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const user = await getUserFromToken(req.headers.authorization);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Ensure pool exists
    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, currency, status")
      .eq("ride_id", rideId)
      .maybeSingle();
    if (!pool) return res.status(404).json({ error: "Ride pool not found" });
    if (pool.status !== "collecting")
      return res.status(400).json({ error: "Pool not collecting" });

    // Upsert: either create new "pending" contribution or refresh existing one
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
          created_at: new Date().toISOString(), // reset lock
        },
        { onConflict: "ride_pool_id,user_id" }
      )
      .select("id, created_at")
      .single();

    if (contribErr || !contrib) {
      console.error("❌ lock-seat upsert error:", contribErr);
      return res.status(500).json({ error: "Could not create contribution" });
    }

    // Expire after 5 minutes
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

export default router;
