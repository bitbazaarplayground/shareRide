// backend/routes/payments.js
import express from "express";
import { sendEmail, templates } from "../helpers/email.js";
import { supabase } from "../supabaseClient.js";

import { getVehicleCapacity } from "../helpers/capacity.js";
import { clamp, toMinor } from "../helpers/pricing.js";
import { recalcAndMaybeMarkBookable } from "../helpers/ridePool.js";
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
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const secret = getWebhookSecret();
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
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

      // 1️⃣ Mark contribution as paid (idempotent)
      const { data: updated, error: uErr } = await supabase
        .from("ride_pool_contributions")
        .update({
          status: "paid",
          stripe_session_id: session.id,
          payment_intent_id: session.payment_intent,
          amount_total_minor: session.amount_total ?? null,
        })
        .eq("id", contributionId)
        .in("status", ["pending"])
        .select("id, ride_pool_id, is_host, user_id")
        .single();

      if (uErr || !updated) {
        console.error("❌ Contribution update failed:", uErr?.message);
        return res.json({ received: true });
      }

      const ridePoolId = updated.ride_pool_id;
      const isHost = updated.is_host;
      const payerId = updated.user_id;

      // 2️⃣ Recalculate totals and update ride pool status
      await recalcAndMaybeMarkBookable(ridePoolId);

      // 3️⃣ Load context data for emails
      // first: get the pool (this table does NOT have from/to/date/time)
      const { data: ridePool, error: poolErr } = await supabase
        .from("ride_pools")
        .select("id, ride_id, status, min_contributors")
        .eq("id", ridePoolId)
        .single();

      if (poolErr || !ridePool) {
        console.warn(
          "⚠️ Could not load ride_pools row for",
          ridePoolId,
          poolErr?.message
        );
        return res.json({ received: true });
      }

      // now: get the actual ride info (this DOES have from/to/date/time)
      const { data: rideRow, error: rideErr } = await supabase
        .from("rides")
        .select("from, to, date, time, user_id")
        .eq("id", ridePool.ride_id)
        .single();

      if (rideErr || !rideRow) {
        console.warn(
          "⚠️ Could not load rides row for",
          ridePool.ride_id,
          rideErr?.message
        );
        return res.json({ received: true });
      }

      // also get paid members (to email them later)
      const { data: members } = await supabase
        .from("ride_pool_contributions")
        .select("user_id, is_host, status, profiles(email, nickname)")
        .eq("ride_pool_id", ridePoolId)
        .eq("status", "paid");

      // build a clean object we can pass to templates
      const rideInfo = {
        from: rideRow.from || "—",
        to: rideRow.to || "—",
        date: rideRow.date || "—",
        time: rideRow.time || "—",
        rideId: ridePool.ride_id,
        hostUserId: rideRow.user_id,
      };

      // 4️⃣ Determine payer email
      let payerEmail =
        session.customer_details?.email || session.customer_email || null;
      if (!payerEmail && session?.metadata?.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", session.metadata.user_id)
          .single();
        payerEmail = prof?.email || null;
      }

      // 5️⃣ Logic split: passenger vs host
      if (!isHost) {
        console.log("🚗 Passenger booked a ride");

        // Find host and passenger
        const host = members.find((m) => m.is_host);
        const passenger = members.find((m) => m.user_id === payerId);
        const passengerName =
          passenger?.profiles?.nickname ||
          session.customer_details?.name ||
          "a passenger";

        // ✅ Ensure we always have host email and nickname
        let hostEmail = host?.profiles?.email || null;
        let hostNickname = host?.profiles?.nickname || "the ride host";

        if (!hostEmail && rideInfo.hostUserId) {
          const { data: hostProf } = await supabase
            .from("profiles")
            .select("email, nickname")
            .eq("id", rideInfo.hostUserId)
            .single();

          if (hostProf) {
            hostEmail = hostProf.email;
            hostNickname = hostProf.nickname || hostNickname;
          }
        }

        // a) Passenger email: confirmation of their booking
        const emailP = templates.passengerBooked({
          ...rideInfo,
          host: hostNickname,
          amount: ((session.amount_total ?? 0) / 100).toFixed(2),
          currency: String(session.currency || "gbp").toUpperCase(),
        });

        if (payerEmail) {
          await sendEmail(payerEmail, emailP.subject, emailP.html, emailP.text);
          console.log(`📧 Passenger email sent to ${payerEmail}`);
        }

        // b) Host email: notification that someone joined their ride
        if (hostEmail) {
          const rideLink = `http://localhost:5173/my-rides/${rideInfo.rideId}`;
          const emailH = templates.hostNotified({
            ...rideInfo,
            nickname: passengerName,
            rideLink, // optional link for future UI
          });

          await sendEmail(hostEmail, emailH.subject, emailH.html, emailH.text);
          console.log(`📧 Host email sent to ${hostEmail}`);
        } else {
          console.warn("⚠️ No host email found — host not notified.");
        }

        console.log("📧 Passenger + host notified successfully");
      } else {
        console.log("👑 Host confirmed ride (paid)");

        await supabase
          .from("ride_pools")
          .update({ status: "confirmed" })
          .eq("id", ridePoolId);

        const { data: paidMembers } = await supabase
          .from("ride_pool_contributions")
          .select("profiles(email)")
          .eq("ride_pool_id", ridePoolId)
          .eq("status", "paid");

        const emailT = templates.rideConfirmed(rideInfo);

        for (const m of paidMembers || []) {
          const email = m.profiles?.email;
          if (email) {
            await sendEmail(email, emailT.subject, emailT.html, emailT.text);
            console.log(`📧 Ride confirmed email sent to ${email}`);
          }
        }

        console.log("📧 Ride confirmed emails sent to all participants");
      }

      return res.json({ received: true });
    }

    // other event types if needed
    res.json({ received: true });
  } catch (e) {
    console.error("💥 Webhook handler error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
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
    if (pool.status !== "collecting")
      return res.status(400).json({ error: "Pool not collecting" });

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
      )}`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("create-checkout-session failed:", err);
    return res.status(500).json({ error: "Failed to create session" });
  }
});
/* ---------------------- Host Confirmation Checkout ---------------------- */
router.post("/create-host-session", express.json(), async (req, res) => {
  try {
    const { rideId, userId, email, currency = "gbp" } = req.body;

    // ===== Auth =====
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Missing token" });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // 🔒 Cross-check that the caller’s userId matches the verified JWT user.id
    if (user.id !== userId) {
      return res.status(403).json({ error: "User mismatch" });
    }

    // ===== Ensure pool exists =====
    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, status, currency")
      .eq("ride_id", rideId)
      .maybeSingle();
    if (!pool) return res.status(404).json({ error: "Pool not found" });

    // ===== Host contribution (must be pending) =====
    const { data: contrib } = await supabase
      .from("ride_pool_contributions")
      .select("id, is_host, status, seats_reserved, user_share_minor")
      .eq("ride_pool_id", pool.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!contrib || !contrib.is_host) {
      return res.status(400).json({ error: "Not host of this ride" });
    }
    if (contrib.status !== "pending") {
      return res.status(400).json({ error: "Host already confirmed" });
    }

    // ===== Fetch ride details for estimate =====
    const { data: rideRow } = await supabase
      .from("rides")
      .select("estimated_fare, seats, vehicle_type")
      .eq("id", rideId)
      .single();
    if (!rideRow) return res.status(404).json({ error: "Ride not found" });

    // Default share: host covers at least their seats
    const estimate = Number(rideRow?.estimated_fare ?? 35);
    const estimateMinor = toMinor(estimate);
    const hostSeats = Number(rideRow?.seats ?? 1);
    const perSeatMinor = Math.max(1, Math.round(estimateMinor / hostSeats));
    const userShareMinor = perSeatMinor * hostSeats;

    // Platform fee for host
    const platformFeeMinor =
      clamp(Math.round(userShareMinor * 0.1), 100, 800) || 0;

    // Update host contribution row
    const { error: updErr } = await supabase
      .from("ride_pool_contributions")
      .update({
        currency,
        user_share_minor: userShareMinor,
        platform_fee_minor: platformFeeMinor,
        seats_reserved: hostSeats,
      })
      .eq("id", contrib.id);
    if (updErr) return res.status(400).json({ error: updErr.message });

    // ===== Stripe Checkout =====
    const lineItems = [];
    if (userShareMinor > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: `Host seats x${hostSeats}` },
          unit_amount: userShareMinor,
        },
        quantity: 1,
      });
    }
    if (platformFeeMinor > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: "Platform fee (host)" },
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
        is_host: "true",
      },
      payment_intent_data: {
        capture_method: "manual",
        transfer_group: `ride_${rideId}`,
      },
      success_url: `${APP_ORIGIN}/payment-success?session_id={CHECKOUT_SESSION_ID}&rideId=${encodeURIComponent(
        String(rideId)
      )}`,
      cancel_url: `${APP_ORIGIN}/my-rides?tab=published`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("create-host-session failed:", err);
    return res.status(500).json({ error: "Failed to create host session" });
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
