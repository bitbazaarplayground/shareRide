// backend/routes/payments.js
import express from "express";
import { APP_ORIGIN, sendEmail, templates } from "../helpers/email.js";
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
router.post(
  "/webhook",
  // IMPORTANT: Stripe requires raw body for signature verification
  express.raw({ type: "application/json" }),
  async (req, res) => {
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

        // --- SEAT CAPACITY AUTO-CLOSE (same as before) ---
        try {
          const { data: poolData, error: poolDataErr } = await supabase
            .from("ride_pools")
            .select("id, ride_id")
            .eq("id", ridePoolId)
            .single();

          if (!poolDataErr && poolData?.ride_id) {
            const { data: rideData } = await supabase
              .from("rides")
              .select("seats, vehicle_type")
              .eq("id", poolData.ride_id)
              .single();

            const { seat: seatCap } = getVehicleCapacity(rideData.vehicle_type);
            const { data: seatRows } = await supabase
              .from("ride_pool_contributions")
              .select("seats_reserved, status")
              .eq("ride_pool_id", ridePoolId)
              .eq("status", "paid");

            const totalSeats = (seatRows || []).reduce(
              (sum, r) => sum + (Number(r.seats_reserved) || 0),
              0
            );

            if (totalSeats >= seatCap) {
              await supabase
                .from("ride_pools")
                .update({ status: "closed" })
                .eq("id", ridePoolId);
              console.log(`🚫 Ride pool ${ridePoolId} closed (seats full)`);
            }
          }
        } catch (err) {
          console.warn("⚠️ Auto-close seat check failed:", err.message);
        }

        // 3️⃣ Load pool + ride data for emails and code generation
        const { data: ridePool, error: poolErr } = await supabase
          .from("ride_pools")
          .select("id, ride_id, status, min_contributors")
          .eq("id", ridePoolId)
          .single();

        if (poolErr || !ridePool) return res.json({ received: true });

        const { data: rideRow } = await supabase
          .from("rides")
          .select("from, to, date, time, user_id")
          .eq("id", ridePool.ride_id)
          .single();

        const { data: members } = await supabase
          .from("ride_pool_contributions")
          .select("user_id, is_host, status, profiles(email, nickname)")
          .eq("ride_pool_id", ridePoolId)
          .in("status", ["pending", "paid"]);

        const rideInfo = {
          from: rideRow.from,
          to: rideRow.to,
          date: rideRow.date,
          time: rideRow.time,
          rideId: ridePool.ride_id,
          hostUserId: rideRow.user_id,
        };

        // 4️⃣ Handle host vs passenger logic
        if (!isHost) {
          console.log("🚗 Passenger booked a ride");
          await supabase
            .from("ride_pools")
            .update({
              status: "collecting",
              confirm_by: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            })
            .eq("id", ridePoolId);

          const host =
            members.find((m) => m.is_host) ||
            (await supabase
              .from("rides")
              .select("profiles(email, nickname)")
              .eq("id", ridePool.ride_id)
              .single()
              .then(({ data }) => ({
                profiles: data?.profiles,
              })));

          const passenger = members.find((m) => m.user_id === payerId);

          const hostEmail = host?.profiles?.email || null;
          const hostNickname = host?.profiles?.nickname || "the ride host";
          const passengerEmail =
            session.customer_details?.email || passenger?.profiles?.email;

          // Send passenger + host notifications
          if (passengerEmail) {
            const emailP = templates.passengerBooked({
              ...rideInfo,
              host: hostNickname,
              amount: ((session.amount_total ?? 0) / 100).toFixed(2),
              currency: String(session.currency || "gbp").toUpperCase(),
            });
            await sendEmail(
              passengerEmail,
              emailP.subject,
              emailP.html,
              emailP.text
            );
            console.log(`📧 Passenger email sent to ${passengerEmail}`);
          }

          if (hostEmail) {
            const rideLink = `${APP_ORIGIN.replace(/\/$/, "")}/my-rides/${
              rideInfo.rideId
            }`;

            const emailH = templates.hostNotified({
              ...rideInfo,
              nickname: passenger?.profiles?.nickname || "a passenger",
              rideLink,
            });

            await sendEmail(
              hostEmail,
              emailH.subject,
              emailH.html,
              emailH.text
            );
            console.log(`📧 Host email sent to ${hostEmail}`);
          }
        } else {
          console.log("👑 Host confirmed ride (paid)");

          // ✅ Mark pool as confirmed
          await supabase
            .from("ride_pools")
            .update({ status: "confirmed" })
            .eq("id", ridePoolId);

          // ✅ Generate unique code for each paid member (NEW)
          const { data: rideData, error: rideFetchErr } = await supabase
            .from("rides")
            .select("date, time")
            .eq("id", rideInfo.rideId)
            .single();

          if (!rideFetchErr && rideData) {
            const rideStart = new Date(`${rideData.date}T${rideData.time}`);
            const expiresAtDefault = new Date(
              rideStart.getTime() + 10 * 60 * 1000
            ).toISOString();

            for (const m of members || []) {
              const code = generateCode6();
              const issuedAt = new Date();

              await supabase
                .from("ride_pool_contributions")
                .update({
                  booking_code: code,
                  code_issued_at: issuedAt.toISOString(),
                  code_expires_at: expiresAtDefault,
                })
                .eq("ride_pool_id", ridePoolId)
                .eq("user_id", m.user_id);

              console.log(
                `🎟️ Code ${code} issued to user ${m.user_id} for ride ${rideInfo.rideId}`
              );
            }
          }

          // ✅ Freeze totals
          const { data: paidContribs } = await supabase
            .from("ride_pool_contributions")
            .select(
              "seats_reserved, backpacks_reserved, small_reserved, large_reserved"
            )
            .eq("ride_pool_id", ridePoolId)
            .eq("status", "paid");

          const totals = (paidContribs || []).reduce(
            (acc, c) => {
              acc.seats += Number(c.seats_reserved || 0);
              acc.backpacks += Number(c.backpacks_reserved || 0);
              acc.small += Number(c.small_reserved || 0);
              acc.large += Number(c.large_reserved || 0);
              return acc;
            },
            { seats: 0, backpacks: 0, small: 0, large: 0 }
          );

          await supabase
            .from("ride_pools")
            .update({
              total_reserved_seats: totals.seats,
              total_reserved_backpacks: totals.backpacks,
              total_reserved_small: totals.small,
              total_reserved_large: totals.large,
            })
            .eq("id", ridePoolId);

          console.log(
            `📊 Ride pool ${ridePoolId} totals frozen: ${totals.seats} seats.`
          );

          // ✅ Notify all paid members
          const emailT = templates.rideConfirmed(rideInfo);
          for (const m of members || []) {
            const email = m.profiles?.email;
            if (email) {
              await sendEmail(email, emailT.subject, emailT.html, emailT.text);
              console.log(`📧 Ride confirmed email sent to ${email}`);
            }
          }
        }

        return res.json({ received: true });
      }

      // other event types
      res.json({ received: true });
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
/* ---------------------- Auto-Promote Fallback Host ---------------------- */
router.post("/cleanup-auto-promote", async (req, res) => {
  try {
    // 🔒 Verify authorization
    const authHeader = req.headers.authorization;
    const JOB_SECRET = process.env.JOB_SECRET;

    if (!JOB_SECRET) {
      console.warn("⚠️ JOB_SECRET missing in environment!");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    if (authHeader !== `Bearer ${JOB_SECRET}`) {
      console.warn("🚫 Unauthorized cleanup-auto-promote attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const nowIso = new Date().toISOString();

    // 1️⃣ Find expired pools still collecting
    const { data: expiredPools, error: poolsErr } = await supabase
      .from("ride_pools")
      .select("id, ride_id, status")
      .lt("confirm_by", nowIso)
      .eq("status", "collecting");

    if (poolsErr) throw poolsErr;

    let promoted = 0;

    for (const pool of expiredPools || []) {
      // 🧠 Double-check this pool wasn’t already processed
      const { data: poolCheck, error: poolCheckErr } = await supabase
        .from("ride_pools")
        .select("status")
        .eq("id", pool.id)
        .maybeSingle();

      if (poolCheckErr) {
        console.warn(`⚠️ Could not recheck pool ${pool.id}`, poolCheckErr);
        continue;
      }

      if (!poolCheck || poolCheck.status === "confirmed") {
        console.log(`⏭️ Pool ${pool.id} already confirmed — skipping`);
        continue;
      }

      // 2️⃣ Find first paid passenger
      const { data: firstPaid, error: paidErr } = await supabase
        .from("ride_pool_contributions")
        .select("user_id, created_at")
        .eq("ride_pool_id", pool.id)
        .eq("status", "paid")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (paidErr || !firstPaid) continue;

      // 🔎 Find current host (if any)
      const { data: currentHost } = await supabase
        .from("ride_pool_contributions")
        .select("user_id")
        .eq("ride_pool_id", pool.id)
        .eq("is_host", true)
        .maybeSingle();

      // 🔁 Demote old host (if exists)
      if (currentHost?.user_id) {
        await supabase
          .from("ride_pool_contributions")
          .update({
            is_host: false,
            lost_host: true,
            lost_host_reason: "confirm_timeout",
            host_changed_at: new Date().toISOString(),
          })
          .eq("ride_pool_id", pool.id)
          .eq("user_id", currentHost.user_id);
      }

      // 3️⃣ Promote new host
      const { error: promoteErr } = await supabase
        .from("ride_pool_contributions")
        .update({ is_host: true })
        .eq("ride_pool_id", pool.id)
        .eq("user_id", firstPaid.user_id);

      if (promoteErr) {
        console.warn(
          `⚠️ Could not promote new host for pool ${pool.id}`,
          promoteErr
        );
        continue;
      }

      /* ---------------------------  🆕 KEEP SOURCE OF TRUTH IN SYNC  --------------------------- */
      // 🆕 3.1 Ensure the ride owner reflects the newly promoted host
      const { data: rideOwnerRow, error: rideOwnerFetchErr } = await supabase
        .from("rides")
        .select("user_id")
        .eq("id", pool.ride_id)
        .single();

      if (rideOwnerFetchErr) {
        console.warn(
          `⚠️ Could not fetch ride owner for ride ${pool.ride_id}`,
          rideOwnerFetchErr
        );
      } else if (rideOwnerRow?.user_id !== firstPaid.user_id) {
        const { error: rideOwnerUpdateErr } = await supabase
          .from("rides")
          .update({ user_id: firstPaid.user_id })
          .eq("id", pool.ride_id);
        if (rideOwnerUpdateErr) {
          console.warn(
            `⚠️ Could not update ride owner for ride ${pool.ride_id}`,
            rideOwnerUpdateErr
          );
        } else {
          console.log(
            `🔄 Ride ${pool.ride_id} owner set to new host ${firstPaid.user_id}`
          );
        }
      }

      // 🆕 3.2 If you have ride_pools.host_user_id, mirror it too (safe no-op if column missing)
      try {
        const { error: hostColErr } = await supabase
          .from("ride_pools")
          .update({ host_user_id: firstPaid.user_id }) // <-- only if this column exists in your schema
          .eq("id", pool.id);
        if (hostColErr) {
          // If the column doesn't exist, this will error; logging is enough.
          console.debug(
            `(optional) host_user_id update skipped for pool ${pool.id}:`,
            hostColErr.message
          );
        }
      } catch (e) {
        console.debug(
          `(optional) host_user_id update skipped for pool ${pool.id}:`,
          e.message
        );
      }
      /* ----------------------------------------------------------------------------------------- */

      // 4️⃣ Mark pool as booked (your enum allows 'booked')
      const { error: updateErr } = await supabase
        .from("ride_pools")
        .update({ status: "booked" })
        .eq("id", pool.id);

      if (updateErr) {
        console.error(`❌ Failed to mark pool ${pool.id} as booked`, updateErr);
        continue;
      }

      console.log(`✅ Pool ${pool.id} marked as booked`);

      // 5️⃣ Get ride info (for email)
      const { data: ride } = await supabase
        .from("rides")
        .select("from, to, date, time")
        .eq("id", pool.ride_id)
        .single();

      // 6️⃣ Fetch all paid members (include lost_host flag)
      const { data: members } = await supabase
        .from("ride_pool_contributions")
        .select("profiles(email, nickname), user_id, is_host, lost_host")
        .eq("ride_pool_id", pool.id)
        .eq("status", "paid");

      const newHost = members.find((m) => m.user_id === firstPaid.user_id);
      const others = members.filter((m) => m.user_id !== firstPaid.user_id);

      const rideLink = `${APP_ORIGIN.replace(/\/$/, "")}/my-rides/${
        pool.ride_id
      }`;

      // 7️⃣ Email new host
      if (newHost?.profiles?.email) {
        const emailH = templates.newHostPromotion({
          from: ride.from,
          to: ride.to,
          date: ride.date,
          time: ride.time,
          rideLink,
        });

        await sendEmail(
          newHost.profiles.email,
          emailH.subject,
          emailH.html,
          emailH.text
        );
        console.log(`📧 Notified new host ${newHost.profiles.email}`);
      }

      // 8️⃣ Email others politely
      for (const m of others) {
        if (!m.profiles?.email) continue;

        const emailP = templates.hostAutoPromoted({
          from: ride.from,
          to: ride.to,
          date: ride.date,
          time: ride.time,
          rideLink,
        });

        await sendEmail(
          m.profiles.email,
          emailP.subject,
          emailP.html,
          emailP.text
        );
      }

      console.log(
        `👑 Auto-promoted user ${firstPaid.user_id} for pool ${pool.id}`
      );
      promoted++;
    }

    // 🕓 Summary log with timestamp
    const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
    if (!expiredPools || expiredPools.length === 0) {
      console.log(
        `⏸️ [${timestamp} UTC] No expired ride pools found this cycle.`
      );
    } else {
      console.log(
        `✅ [${timestamp} UTC] Checked ${
          expiredPools.length
        } expired pools — ${promoted} promoted, ${
          expiredPools.length - promoted
        } skipped.`
      );
    }

    res.json({ promoted });
  } catch (err) {
    console.error("auto-promote failed:", err);
    res.status(500).json({ error: "Auto-promote failed" });
  }
});

/* ---------------------- Cleanup No-Show Riders ---------------------- */
router.post("/cleanup-no-show", async (req, res) => {
  console.log("🕒 cleanup-no-show called OK");

  try {
    // Verify GitHub cron secret
    const authHeader = req.headers.authorization || "";
    const providedSecret = authHeader.replace("Bearer ", "").trim();
    if (!providedSecret || providedSecret !== process.env.CRON_SECRET_NOSHOW) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const now = new Date();

    // 1️⃣ Find rides in check-in stage past their start time + 10min
    const { data: latePools } = await supabase
      .from("ride_pools")
      .select(
        "id, ride_id, booker_user_id, status, code_issued_at, code_expires_at"
      )
      .eq("status", "checking_in")
      .lt("code_expires_at", now.toISOString());

    let promotedCount = 0;
    let canceledCount = 0;

    for (const pool of latePools || []) {
      // Fetch contributions
      const { data: contribs } = await supabase
        .from("ride_pool_contributions")
        .select("user_id, is_host, checked_in_at, status")
        .eq("ride_pool_id", pool.id);

      const paid = contribs.filter((c) => c.status === "paid");
      const checkedIn = paid.filter((c) => !!c.checked_in_at);
      const host = contribs.find((c) => c.is_host);

      // Host missing but passengers checked in → promote one
      if (!host?.checked_in_at && checkedIn.length > 0) {
        const newHost = checkedIn[0]; // promote first
        await supabase
          .from("ride_pool_contributions")
          .update({ is_host: true })
          .eq("ride_pool_id", pool.id)
          .eq("user_id", newHost.user_id);

        await supabase
          .from("ride_pools")
          .update({ booker_user_id: newHost.user_id, status: "ready_to_book" })
          .eq("id", pool.id);

        promotedCount++;
        console.log(`👑 Auto-promoted ${newHost.user_id} in pool ${pool.id}`);
        continue;
      }

      // No one checked in → cancel
      if (checkedIn.length === 0) {
        await supabase
          .from("ride_pools")
          .update({ status: "canceled" })
          .eq("id", pool.id);
        canceledCount++;
        console.log(`❌ Ride pool ${pool.id} canceled (no one checked in)`);
      }
    }

    return res.json({ promoted: promotedCount, canceled: canceledCount });
  } catch (e) {
    console.error("cleanup-no-show error:", e);
    res.status(500).json({ error: "Failed to cleanup no-shows" });
  }
});

// ---------------------- Simulate Host Confirm (for testing) ----------------------

// ⚠️ TEMPORARY TEST ENDPOINT – simulate host payment webhook
router.post("/test/simulate-host-confirm", async (req, res) => {
  const { ridePoolId } = req.body;
  try {
    console.log("🧪 Simulating host confirmation for pool", ridePoolId);

    // Same logic as webhook's host-confirm block
    const { data: paidContribs } = await supabase
      .from("ride_pool_contributions")
      .select(
        "seats_reserved, backpacks_reserved, small_reserved, large_reserved"
      )
      .eq("ride_pool_id", ridePoolId)
      .eq("status", "paid");

    const totals = (paidContribs || []).reduce(
      (acc, c) => {
        acc.seats += Number(c.seats_reserved || 0);
        acc.backpacks += Number(c.backpacks_reserved || 0);
        acc.small += Number(c.small_reserved || 0);
        acc.large += Number(c.large_reserved || 0);
        return acc;
      },
      { seats: 0, backpacks: 0, small: 0, large: 0 }
    );

    await supabase
      .from("ride_pools")
      .update({
        status: "confirmed",
        total_reserved_seats: totals.seats,
        total_reserved_backpacks: totals.backpacks,
        total_reserved_small: totals.small,
        total_reserved_large: totals.large,
      })
      .eq("id", ridePoolId);

    console.log("✅ Pool confirmed and totals frozen:", totals);
    return res.json({ ok: true, totals });
  } catch (err) {
    console.error("simulate-host-confirm failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
