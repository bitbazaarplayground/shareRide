// backend/routes/payments.js
import express from "express";
import { supabase } from "../helpers/auth.js";
import { sendEmail } from "../helpers/email.js";
import { clamp, toMinor } from "../helpers/pricing.js";
import { recalcAndMaybeMarkBookable } from "../helpers/ridePool.js";
import { stripe, verifyStripeSignatureOrThrow } from "../helpers/stripe.js";

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

/* ---------------------- Stripe Webhook (RAW body) ---------------------- */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;
    try {
      event = verifyStripeSignatureOrThrow(req);
      console.log("🔔 Stripe event:", event.type);
    } catch (err) {
      console.error("❌ Stripe signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const contributionId = Number(session.metadata?.contribution_id || 0);
        if (!contributionId) return res.json({ received: true });

        // 1) Mark contribution as paid (idempotent)
        const { data: updated } = await supabase
          .from("ride_pool_contributions")
          .update({
            status: "paid",
            stripe_session_id: session.id,
            payment_intent_id: session.payment_intent,
            amount_total_minor: session.amount_total ?? null,
          })
          .eq("id", contributionId)
          .in("status", ["pending"])
          .select("id, ride_pool_id")
          .single();

        // Fallback: fetch pool id even if already paid
        let ridePoolId = updated?.ride_pool_id;
        if (!ridePoolId) {
          const { data: lookup } = await supabase
            .from("ride_pool_contributions")
            .select("ride_pool_id")
            .eq("id", contributionId)
            .single();
          ridePoolId = lookup?.ride_pool_id || null;
        }
        if (ridePoolId) {
          await recalcAndMaybeMarkBookable(ridePoolId);
        }

        // 2) Email receipt (best-effort)
        let customerEmail =
          session.customer_details?.email || session.customer_email || null;

        if (!customerEmail && session?.metadata?.user_id) {
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", session.metadata.user_id)
              .single();
            if (prof?.email) customerEmail = prof.email;
          } catch {}
        }

        // ride details for email
        let fromLoc = "—",
          toLoc = "—",
          date = "—",
          time = "—",
          poster = "Host";
        try {
          const rideIdMeta = Number(session.metadata?.ride_id || 0);
          if (rideIdMeta) {
            const { data: rideRow } = await supabase
              .from("rides")
              .select("from, to, date, time, user_id")
              .eq("id", rideIdMeta)
              .single();
            if (rideRow) {
              fromLoc = rideRow.from ?? "—";
              toLoc = rideRow.to ?? "—";
              date = rideRow.date ?? "—";
              time = rideRow.time ?? "—";
              if (rideRow.user_id) {
                const { data: prof2 } = await supabase
                  .from("profiles")
                  .select("nickname")
                  .eq("id", rideRow.user_id)
                  .single();
                poster = prof2?.nickname || "Host";
              }
            }
          }
        } catch {}

        if (customerEmail) {
          const amount = ((session.amount_total ?? 0) / 100).toFixed(2);
          const currency = String(session.currency || "gbp").toUpperCase();

          const html = `
            <div style="font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#111; line-height:1.5;">
              <h2 style="margin:0 0 12px">✅ Payment confirmed</h2>
              <p>Thanks for splitting your ride on <strong>TabFair</strong>!</p>
              <div style="margin:16px 0; padding:12px; border:1px solid #eee; border-radius:10px;">
                <div><strong>From:</strong> ${fromLoc}</div>
                <div><strong>To:</strong> ${toLoc}</div>
                <div><strong>Date:</strong> ${date}</div>
                <div><strong>Time:</strong> ${time}</div>
                <div><strong>Ride host:</strong> ${poster}</div>
                <div><strong>Amount charged:</strong> ${amount} ${currency}</div>
              </div>
              <p>We’ll notify you when your group is ready. The booker can then open Uber and complete the booking.</p>
            </div>
          `;
          const text = [
            "Payment confirmed on TabFair",
            `From: ${fromLoc}`,
            `To: ${toLoc}`,
            `Date: ${date}`,
            `Time: ${time}`,
            `Ride host: ${poster}`,
            `Amount charged: ${amount} ${currency}`,
          ].join("\n");

          await sendEmail(
            customerEmail,
            "✅ TabFair · Payment confirmed",
            html,
            text
          );
        }
      }

      return res.json({ received: true });
    } catch (e) {
      console.error("💥 Webhook handler error:", e);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

/* ---------------------- Create Checkout Session ---------------------- */
router.post("/create-checkout-session", express.json(), async (req, res) => {
  try {
    const {
      rideId,
      userId,
      email,
      currency = "gbp",

      // new inputs
      seatsReserved,
      backpacks = 0,
      small = 0,
      large = 0,
      totalItems,

      // legacy inputs
      seats,
      groupSize: legacyGroupSize,
    } = req.body;

    // ===== Auth (Supabase) =====
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

    // ===== Normalize seat/luggage =====
    const seatsReq = Math.max(
      1,
      Number.isFinite(+seatsReserved)
        ? Math.floor(+seatsReserved)
        : Number.isFinite(+seats)
          ? Math.floor(+seats)
          : Number.isFinite(+legacyGroupSize)
            ? Math.floor(+legacyGroupSize)
            : 1
    );
    const bReq = Math.max(0, Math.floor(Number(backpacks) || 0));
    const sReq = Math.max(0, Math.floor(Number(small) || 0));
    const lReq = Math.max(0, Math.floor(Number(large) || 0));
    const totalReq = Math.max(0, Math.floor(Number(totalItems) || 0));

    if (!rideId || !email || !Number.isFinite(seatsReq)) {
      return res.status(400).json({ error: "Missing/invalid fields" });
    }

    // ===== Ensure pool exists & is collecting =====
    const { data: pool } = await supabase
      .from("ride_pools")
      .select(
        "id, status, currency, min_contributors, total_reserved_seats, total_reserved_backpacks, total_reserved_small, total_reserved_large"
      )
      .eq("ride_id", rideId)
      .maybeSingle();
    if (!pool) return res.status(404).json({ error: "Pool not found" });
    if (pool.status !== "collecting") {
      return res.status(400).json({ error: "Pool not collecting" });
    }

    // ===== Enforce active booking lock (pending contribution not expired) =====
    const { data: pending } = await supabase
      .from("ride_pool_contributions")
      .select("id, created_at, status")
      .eq("ride_pool_id", pool.id)
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pending)
      return res.status(400).json({ error: "No active booking lock found" });
    const createdAtMs = new Date(pending.created_at).getTime();
    const expiresAtMs = createdAtMs + 5 * 60 * 1000;
    if (Date.now() > expiresAtMs) {
      return res.status(400).json({ error: "Booking lock expired" });
    }

    // ===== Fetch ride for capacity/estimate =====
    const { data: rideRow, error: rideErr } = await supabase
      .from("rides")
      .select(
        "estimated_fare, seat_limit, seats, max_passengers, backpack_count, small_suitcase_count, large_suitcase_count, luggage_limit"
      )
      .eq("id", rideId)
      .single();
    if (rideErr || !rideRow)
      return res.status(404).json({ error: "Ride not found" });

    // ===== Capacity checks (server-trust) =====
    const capacity =
      Number(rideRow?.seat_limit) ||
      Number(rideRow?.seats) ||
      Number(rideRow?.max_passengers) ||
      4;

    // Already PAID seats in pool
    const { data: paidRows } = await supabase
      .from("ride_pool_contributions")
      .select("seats_reserved")
      .eq("ride_pool_id", pool.id)
      .eq("status", "paid");

    const paidSeats = (paidRows || []).reduce(
      (s, r) => s + (Number(r.seats_reserved) || 0),
      0
    );
    const hostSeats = Number(rideRow?.seats ?? 1);
    const remainingSeats = Math.max(capacity - (hostSeats + paidSeats), 0);
    if (seatsReq > remainingSeats) {
      return res
        .status(400)
        .json({ error: `Not enough seats. Remaining: ${remainingSeats}` });
    }

    // Luggage validation (by-kind preferred)
    const bLimit = Number(rideRow?.backpack_count ?? 0);
    const sLimit = Number(rideRow?.small_suitcase_count ?? 0);
    const lLimit = Number(rideRow?.large_suitcase_count ?? 0);
    const totalLimit = Number(rideRow?.luggage_limit ?? 0);
    const hasByKind = bLimit || sLimit || lLimit;

    const paidB = Number(pool?.total_reserved_backpacks ?? 0);
    const paidS = Number(pool?.total_reserved_small ?? 0);
    const paidL = Number(pool?.total_reserved_large ?? 0);

    if (hasByKind) {
      const rB = Math.max(0, bLimit - paidB);
      const rS = Math.max(0, sLimit - paidS);
      const rL = Math.max(0, lLimit - paidL);
      if (bReq > rB)
        return res
          .status(400)
          .json({ error: `Backpacks over limit. Remaining: ${rB}` });
      if (sReq > rS)
        return res
          .status(400)
          .json({ error: `Small suitcases over limit. Remaining: ${rS}` });
      if (lReq > rL)
        return res
          .status(400)
          .json({ error: `Large suitcases over limit. Remaining: ${rL}` });
    } else if (totalLimit) {
      const paidTotal = paidB + paidS + paidL;
      const rTotal = Math.max(0, totalLimit - paidTotal);
      const reqTotal = totalReq > 0 ? totalReq : bReq + sReq + lReq;
      if (reqTotal > rTotal) {
        return res
          .status(400)
          .json({ error: `Luggage over limit. Remaining items: ${rTotal}` });
      }
    }

    // ===== Pricing (match frontend preview) =====
    const estimate = Number(rideRow?.estimated_fare ?? 35);
    const estimateMinor = toMinor(estimate);

    // group size = host(1) + already paid + seats being purchased now
    const groupSize = Math.max(1 + paidSeats + seatsReq, 1);
    const perSeatMinor = Math.max(1, Math.round(estimateMinor / groupSize));
    const userShareMinor = perSeatMinor * seatsReq;
    const platformFeeMinor = clamp(Math.round(userShareMinor * 0.1), 100, 800);

    // ===== Update pending contribution with reservation + price =====
    const insBackpacks = hasByKind
      ? bReq
      : totalLimit
        ? totalReq > 0
          ? totalReq
          : bReq + sReq + lReq
        : 0;
    const insSmall = hasByKind ? sReq : 0;
    const insLarge = hasByKind ? lReq : 0;

    const { error: updErr } = await supabase
      .from("ride_pool_contributions")
      .update({
        currency,
        user_share_minor: userShareMinor,
        platform_fee_minor: platformFeeMinor,
        seats_reserved: seatsReq,
        backpacks_reserved: insBackpacks,
        small_reserved: insSmall,
        large_reserved: insLarge,
      })
      .eq("id", pending.id);
    if (updErr) return res.status(400).json({ error: updErr.message });

    // ===== Stripe Checkout =====
    const lineItems = [];
    if (userShareMinor > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: {
            name: `Seats x${seatsReq} @ ${(perSeatMinor / 100).toFixed(2)} each`,
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
      customer_creation: "if_required",
      line_items: lineItems,
      metadata: {
        ride_id: String(rideId),
        user_id: String(userId),
        contribution_id: String(pending.id),
        seats_reserved: String(seatsReq),
        backpacks: String(insBackpacks),
        small: String(insSmall),
        large: String(insLarge),
      },
      payment_intent_data: {
        setup_future_usage: "off_session",
        transfer_group: `ride_${rideId}`,
        metadata: {
          ride_id: String(rideId),
          user_id: String(userId),
          contribution_id: String(pending.id),
          seats_reserved: String(seatsReq),
          backpacks: String(insBackpacks),
          small: String(insSmall),
          large: String(insLarge),
        },
      },
      success_url: `${APP_ORIGIN}/payment-success?session_id={CHECKOUT_SESSION_ID}&rideId=${encodeURIComponent(
        String(rideId)
      )}`,
      cancel_url: `${APP_ORIGIN}/splitride-confirm/${encodeURIComponent(String(rideId))}`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    const msg = err?.raw?.message || err?.message || "Failed to create session";
    const code = err?.type === "StripeInvalidRequestError" ? 400 : 500;
    console.error("create-checkout-session failed:", err);
    return res.status(code).json({ error: msg });
  }
});

/* ---------------------- Verify (PaymentSuccess UI) ---------------------- */
router.get("/verify", async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId)
      return res.status(400).json({ ok: false, error: "Missing session_id" });
    const cs = await stripe.checkout.sessions.retrieve(sessionId);
    return res.json({
      ok: cs.payment_status === "paid",
      amount_total: cs.amount_total,
      currency: cs.currency,
      livemode: cs.livemode,
    });
  } catch (err) {
    console.error("verify error:", err);
    return res.status(500).json({ ok: false, error: "Lookup failed" });
  }
});

export default router;
