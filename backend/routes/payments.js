// backend/routes/payments.js
import express from "express";
import { supabase } from "../supabaseClient.js";

import { getVehicleCapacity } from "../helpers/capacity.js";
import { clamp, toMinor } from "../helpers/pricing.js";
import { stripe } from "../helpers/stripe.js";

const router = express.Router();

/* ---------------------- Pick correct webhook secret ---------------------- */
function getWebhookSecret() {
  return (
    process.env.STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET_TEST ||
    process.env.STRIPE_WEBHOOK_SECRET_LIVE
  );
}

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

/* ---------------------- Stripe Webhook ---------------------- */
router.post("/webhook", (req, res) => {
  res.json({ disabled: true });
});

/* ---------------------- Create Checkout Session ---------------------- */
router.post("/create-checkout-session", express.json(), async (req, res) => {
  try {
    const {
      rideId,
      userId,
      email,
      currency = "gbp",

      // booking inputs
      seatsReserved,
      backpacks = 0,
      small = 0,
      large = 0,
      totalItems,
    } = req.body;

    // ===== Auth =====
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);
    if (userErr || !user)
      return res.status(401).json({ error: "Invalid token" });
    if (user.id !== userId)
      return res.status(403).json({ error: "User mismatch" });

    // ===== Ensure pool exists =====
    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, status, currency")
      .eq("ride_id", rideId)
      .maybeSingle();

    if (!pool) return res.status(404).json({ error: "Pool not found" });

    // ✅ Allow booking while pool is still collecting or bookable
    if (pool.status === "confirmed") {
      return res.status(400).json({ error: "Ride already confirmed by host" });
    }
    if (pool.status === "canceled") {
      return res.status(400).json({ error: "Ride canceled" });
    }

    // ===== Contribution (must already exist for host, pending for riders) =====
    const { data: contrib } = await supabase
      .from("ride_pool_contributions")
      .select("id, is_host, created_at, status")
      .eq("ride_pool_id", pool.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!contrib || contrib.status !== "pending") {
      return res.status(400).json({ error: "No active pending contribution" });
    }

    // ===== Fetch ride for capacity/estimate =====
    const { data: rideRow } = await supabase
      .from("rides")
      .select(
        "vehicle_type, estimated_fare, seats, backpack_count, small_suitcase_count, large_suitcase_count, luggage_limit"
      )
      .eq("id", rideId)
      .single();
    if (!rideRow) return res.status(404).json({ error: "Ride not found" });

    // ===== Vehicle capacity (true limits) =====
    const {
      seat: seatCap,
      backpack: bCap,
      small: sCap,
      large: lCap,
    } = getVehicleCapacity(rideRow.vehicle_type);

    // Host baseline (always reserved)
    const hostSeats = Number(rideRow?.seats ?? 1);
    const hostB = Number(rideRow?.backpack_count ?? 0);
    const hostS = Number(rideRow?.small_suitcase_count ?? 0);
    const hostL = Number(rideRow?.large_suitcase_count ?? 0);

    // Already PAID contributions
    const { data: paidRows } = await supabase
      .from("ride_pool_contributions")
      .select(
        "seats_reserved, backpacks_reserved, small_reserved, large_reserved"
      )
      .eq("ride_pool_id", pool.id)
      .eq("status", "paid");

    const paidSeats = (paidRows || []).reduce(
      (s, r) => s + (Number(r.seats_reserved) || 0),
      0
    );
    const paidB = (paidRows || []).reduce(
      (s, r) => s + (r.backpacks_reserved || 0),
      0
    );
    const paidS = (paidRows || []).reduce(
      (s, r) => s + (r.small_reserved || 0),
      0
    );
    const paidL = (paidRows || []).reduce(
      (s, r) => s + (r.large_reserved || 0),
      0
    );

    // ===== Capacity checks =====
    const remainingSeats = Math.max(seatCap - (hostSeats + paidSeats), 0);
    if (!contrib.is_host && seatsReserved > remainingSeats) {
      return res
        .status(400)
        .json({ error: `Not enough seats. Remaining: ${remainingSeats}` });
    }

    const rB = Math.max(0, bCap - (hostB + paidB));
    const rS = Math.max(0, sCap - (hostS + paidS));
    const rL = Math.max(0, lCap - (hostL + paidL));

    const bReq = contrib.is_host ? hostB : backpacks;
    const sReq = contrib.is_host ? hostS : small;
    const lReq = contrib.is_host ? hostL : large;

    if (bReq > rB) {
      return res
        .status(400)
        .json({ error: `Backpacks over limit. Remaining: ${rB}` });
    }
    if (sReq > rS) {
      return res
        .status(400)
        .json({ error: `Small suitcases over limit. Remaining: ${rS}` });
    }
    if (lReq > rL) {
      return res
        .status(400)
        .json({ error: `Large suitcases over limit. Remaining: ${rL}` });
    }

    // Optional total luggage mode (from rides.luggage_limit)
    const totalCap = Number(rideRow?.luggage_limit ?? 0);
    if (totalCap > 0 && !(bCap || sCap || lCap)) {
      const paidTotal = paidB + paidS + paidL;
      const rTotal = Math.max(
        0,
        totalCap - (hostB + hostS + hostL + paidTotal)
      );
      const reqTotal = totalItems > 0 ? totalItems : bReq + sReq + lReq;
      if (reqTotal > rTotal) {
        return res
          .status(400)
          .json({ error: `Luggage over limit. Remaining items: ${rTotal}` });
      }
    }

    // ===== Pricing =====
    const estimate = Number(rideRow?.estimated_fare ?? 35);
    const estimateMinor = toMinor(estimate);

    const groupSize = Math.max(hostSeats + paidSeats + seatsReserved, 1);
    const perSeatMinor =
      Math.max(1, Math.round(estimateMinor / groupSize)) || 0;
    const userShareMinor = perSeatMinor * seatsReserved || 0;
    const platformFeeMinor =
      clamp(Math.round(userShareMinor * 0.1), 100, 800) || 0;

    // ===== Update pending contribution =====
    const { error: updErr } = await supabase
      .from("ride_pool_contributions")
      .update({
        currency,
        user_share_minor: userShareMinor,
        platform_fee_minor: platformFeeMinor,
        seats_reserved: seatsReserved,
        backpacks_reserved: bReq,
        small_reserved: sReq,
        large_reserved: lReq,
      })
      .eq("id", contrib.id);
    if (updErr) return res.status(400).json({ error: updErr.message });

    // ===== Stripe Checkout =====
    const lineItems = [];
    if (userShareMinor > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: `Seats x${seatsReserved} @ ${(perSeatMinor / 100).toFixed(
              2
            )} each`,
          },
          unit_amount: userShareMinor,
        },
        quantity: 1,
      });
    }
    if (platformFeeMinor > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: "Platform fee" },
          unit_amount: platformFeeMinor,
        },
        quantity: 1,
      });
    }

    const APP_ORIGIN = getAppOrigin();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email || undefined,
      line_items: lineItems,
      metadata: {
        ride_id: String(rideId),
        user_id: String(userId),
        contribution_id: String(contrib.id),
        is_host: String(contrib.is_host),
      },
      payment_intent_data: {
        capture_method: "manual",
        transfer_group: `ride_${rideId}`,
      },
      success_url: `${APP_ORIGIN}/payment-success?session_id={CHECKOUT_SESSION_ID}&rideId=${encodeURIComponent(
        String(rideId)
      )}`,
      cancel_url: `${APP_ORIGIN}/splitride-confirm/${encodeURIComponent(
        String(rideId)
      )}?canceled=true`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session failed:", err);
    return res.status(500).json({ error: "Failed to create session" });
  }
});

// ---------------------- Verify Checkout Session ----------------------
router.get("/verify", async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id)
      return res.status(400).json({ error: "Missing session_id" });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["payment_intent"],
    });

    // Normalize status
    let reason = session.payment_status;
    if (session.payment_intent && session.payment_intent.status) {
      reason = session.payment_intent.status;
    }

    return res.json({
      ok: true,
      reason,
      amount_total: session.amount_total,
      currency: session.currency,
      livemode: session.livemode,
    });
  } catch (err) {
    console.error("verify error:", err);
    return res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
