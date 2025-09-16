// backend/routes/rides.js
import express from "express";
import { getUserFromToken, supabase } from "../helpers/auth.js";
import { clamp, generateCode6, nowIso } from "../helpers/pricing.js";
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

    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, user_id, status")
      .eq("id", rideId)
      .single();
    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });
    if (ride.status !== "active")
      return res.status(400).json({ error: "Ride is not active" });

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

    return res.json({
      message: "✅ Ride pool created successfully",
      poolId: newPool.id,
    });
  } catch (err) {
    console.error("❌ create-pool error:", err);
    return res.status(500).json({ error: "Failed to create ride pool" });
  }
});

/* ---------------------- Booking status (for UI) ---------------------- */
router.get("/:rideId/booking-status", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const userId = req.query.userId || null;

    // Ensure/Load pool
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
      const { data: rideData } = await supabase
        .from("rides")
        .select("user_id")
        .eq("id", rideId)
        .single();
      if (!rideData?.user_id)
        return res.status(500).json({ error: "Ride not found" });

      const { data: newPool, error: newPoolErr } = await supabase
        .from("ride_pools")
        .insert({
          ride_id: rideId,
          currency: "gbp",
          booker_user_id: rideData.user_id,
          status: "collecting",
        })
        .select(
          "id, status, currency, min_contributors, total_reserved_seats, total_reserved_backpacks, total_reserved_small, total_reserved_large, total_collected_user_share_minor, total_collected_platform_fee_minor, booker_user_id, booking_code, code_expires_at, code_issued_at"
        )
        .single();
      if (newPoolErr)
        return res.status(500).json({ error: "Failed to create ride pool" });
      pool = newPool;
    }

    // Ride capacity + luggage
    const { data: ride } = await supabase
      .from("rides")
      .select(
        "seat_limit, seats, max_passengers, backpack_count, small_suitcase_count, large_suitcase_count, luggage_limit"
      )
      .eq("id", rideId)
      .single();

    // PAID rows
    const { data: paidRows } = await supabase
      .from("ride_pool_contributions")
      .select("user_id, seats_reserved, checked_in_at")
      .eq("ride_pool_id", pool.id)
      .eq("status", "paid");

    const paidSeats = (paidRows || []).reduce(
      (sum, r) => sum + (Number(r.seats_reserved) || 0),
      0
    );
    const paidCount = (paidRows || []).length;
    const checkedInCount = (paidRows || []).filter(
      (r) => !!r.checked_in_at
    ).length;
    const hasPaid =
      !!userId &&
      (paidRows || []).some((r) => String(r.user_id) === String(userId));
    const isBooker = !!userId && pool.booker_user_id === userId;

    const capacity =
      Number(ride?.seat_limit) ||
      Number(ride?.seats) ||
      Number(ride?.max_passengers) ||
      4;
    const hostSeats = Number(ride?.seats ?? 1);
    const remainingSeats = Math.max(capacity - (hostSeats + paidSeats), 0);

    // Luggage remaining calculation (by-kind preferred)
    const bLimit = Number(ride?.backpack_count ?? 0);
    const sLimit = Number(ride?.small_suitcase_count ?? 0);
    const lLimit = Number(ride?.large_suitcase_count ?? 0);
    const totalLimit = Number(ride?.luggage_limit ?? 0);

    const rB = Math.max(0, bLimit - Number(pool.total_reserved_backpacks ?? 0));
    const rS = Math.max(0, sLimit - Number(pool.total_reserved_small ?? 0));
    const rL = Math.max(0, lLimit - Number(pool.total_reserved_large ?? 0));
    const reservedTotal =
      Number(pool.total_reserved_backpacks ?? 0) +
      Number(pool.total_reserved_small ?? 0) +
      Number(pool.total_reserved_large ?? 0);
    const rTotal = Math.max(0, totalLimit - reservedTotal);

    const hasByKind = bLimit > 0 || sLimit > 0 || lLimit > 0;
    const luggageObj = hasByKind
      ? {
          mode: "byKind",
          byKind: {
            backpacks: { limit: bLimit, remaining: rB },
            small: { limit: sLimit, remaining: rS },
            large: { limit: lLimit, remaining: rL },
          },
          total: { limit: 0, remaining: 0 },
        }
      : totalLimit > 0
        ? {
            mode: "total",
            byKind: {
              backpacks: { limit: 0, remaining: 0 },
              small: { limit: 0, remaining: 0 },
              large: { limit: 0, remaining: 0 },
            },
            total: { limit: totalLimit, remaining: rTotal },
          }
        : { mode: "none", byKind: {}, total: { limit: 0, remaining: 0 } };

    // If THIS user has an active pending lock, include expiry
    let lock = null;
    if (userId) {
      const { data: myContrib } = await supabase
        .from("ride_pool_contributions")
        .select("id, created_at, status")
        .eq("ride_pool_id", pool.id)
        .eq("user_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (myContrib?.created_at) {
        lock = {
          contributionId: myContrib.id,
          expiresAt: new Date(
            new Date(myContrib.created_at).getTime() + 5 * 60 * 1000
          ).toISOString(),
        };
      }
    }

    res.json({
      exists: true,
      capacity,
      paidSeats,
      remainingSeats,
      hasPaid,
      status: pool.status,
      currency: pool.currency,
      minContributors: pool.min_contributors,
      paidCount,
      checkedInCount,
      isBooker,
      bookerUserId: pool.booker_user_id,
      capacityV2: {
        seats: { limit: capacity, remaining: remainingSeats },
        luggage: luggageObj,
      },
      totals: {
        userShareMinor: pool.total_collected_user_share_minor,
        platformFeeMinor: pool.total_collected_platform_fee_minor,
      },
      lock,
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
router.post("/:rideId/issue-code", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId, ttlSeconds = 600 } = req.body;

    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, booker_user_id, status")
      .eq("ride_id", rideId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found" });
    if (pool.booker_user_id !== userId)
      return res.status(403).json({ error: "Only booker can issue code" });
    if (pool.status !== "bookable" && pool.status !== "checking_in") {
      return res.status(400).json({ error: "Pool not ready for check-in" });
    }

    const code = generateCode6();
    const ttl = clamp(Number(ttlSeconds), 120, 1800);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + ttl * 1000).toISOString();

    await supabase
      .from("ride_pools")
      .update({
        booking_code: code,
        code_expires_at: expiresAt,
        code_issued_at: issuedAt.toISOString(),
        status: "checking_in",
      })
      .eq("id", pool.id);

    res.json({ code, expiresAt });
  } catch (e) {
    console.error("issue-code error:", e);
    res.status(500).json({ error: "Failed to issue code" });
  }
});

/* ---------------------- Check-in ---------------------- */
router.post("/:rideId/check-in", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId, code, lat, lng } = req.body;

    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, booking_code, code_expires_at, status, min_contributors")
      .eq("ride_id", rideId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found" });

    const expired =
      !pool.code_expires_at || new Date(pool.code_expires_at) <= new Date();
    if (pool.status !== "checking_in" || expired) {
      return res
        .status(400)
        .json({ error: "Check-in not active or code expired" });
    }
    if (!code || code !== pool.booking_code) {
      return res.status(400).json({ error: "Invalid code" });
    }

    // Must be PAID contributor
    const { data: contrib } = await supabase
      .from("ride_pool_contributions")
      .select("id, checked_in_at")
      .eq("ride_pool_id", pool.id)
      .eq("user_id", userId)
      .eq("status", "paid")
      .single();
    if (!contrib)
      return res.status(403).json({ error: "You haven't paid for this ride" });

    // Update check-in (idempotent)
    await supabase
      .from("ride_pool_contributions")
      .update({
        checked_in_at: contrib.checked_in_at || nowIso(),
        checkin_lat: Number.isFinite(Number(lat)) ? Number(lat) : null,
        checkin_lng: Number.isFinite(Number(lng)) ? Number(lng) : null,
      })
      .eq("id", contrib.id);

    // Count checked-in paid contributors
    const { data: paidRows } = await supabase
      .from("ride_pool_contributions")
      .select("id, checked_in_at")
      .eq("ride_pool_id", pool.id)
      .eq("status", "paid");
    const checkedInCount = (paidRows || []).filter(
      (r) => !!r.checked_in_at
    ).length;

    if (checkedInCount >= (pool.min_contributors || 2)) {
      await supabase
        .from("ride_pools")
        .update({ status: "ready_to_book" })
        .eq("id", pool.id);
    }

    res.json({
      ok: true,
      checkedInCount,
      required: pool.min_contributors || 2,
    });
  } catch (e) {
    console.error("check-in error:", e);
    res.status(500).json({ error: "Failed to check in" });
  }
});

/* ---------------------- Claim booker ---------------------- */
router.post("/:rideId/claim-booker", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId, graceSeconds = 180 } = req.body;

    const { data: pool } = await supabase
      .from("ride_pools")
      .select(
        "id, status, booker_user_id, code_issued_at, code_expires_at, min_contributors"
      )
      .eq("ride_id", rideId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found" });

    if (!["checking_in", "ready_to_book"].includes(pool.status)) {
      return res.status(400).json({ error: "Pool not in a claimable state" });
    }
    const issuedAt = pool.code_issued_at ? new Date(pool.code_issued_at) : null;
    if (!issuedAt)
      return res.status(400).json({ error: "No active check-in session" });

    const grace = clamp(Number(graceSeconds), 60, 600);
    const claimNotBefore = new Date(issuedAt.getTime() + grace * 1000);
    if (new Date() < claimNotBefore) {
      return res.status(400).json({
        error: "Too early to claim booker",
        claimAllowedAt: claimNotBefore.toISOString(),
      });
    }

    // Original booker checked in?
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

    // Need quorum
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
