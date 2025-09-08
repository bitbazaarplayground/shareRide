// backend/Server.js
import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { Resend } from "resend";
import Stripe from "stripe";
import { fileURLToPath } from "url";

/* ---------------------- ENV LOADING (robust) ---------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env that sits next to this Server.js even if you run from repo root
dotenv.config({ path: path.join(__dirname, ".env") });

/* ---------------------- Boot checks ---------------------- */
const REQUIRED = [
  "STRIPE_SECRET_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
REQUIRED.forEach((k) => {
  if (!process.env[k]) console.warn(`⚠️ Missing ${k} in env`);
});
if (
  !process.env.STRIPE_WEBHOOK_SECRET_TEST &&
  !process.env.STRIPE_WEBHOOK_SECRET_LIVE &&
  !process.env.STRIPE_WEBHOOK_SECRET
) {
  console.warn("⚠️ No Stripe webhook secret configured (TEST/LIVE/fallback).");
}

/* ---------------------- Setup ---------------------- */
const app = express();

// CORS: allow APP_ORIGIN (comma-separated list supported)
const ORIGINS = (process.env.APP_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // CLI, Postman, SSR etc.
      if (ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS: origin not allowed"));
    },
    credentials: false,
  })
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // account default API version
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// First origin is used for success/cancel URLs
const APP_ORIGIN = (process.env.APP_ORIGIN || "http://localhost:5173").split(
  ","
)[0];
const PORT = process.env.PORT || 3000;

/* ---------------------- Health ---------------------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ---------------------- Helpers ---------------------- */
const toMinor = (gbp) => Math.round(Number(gbp) * 100);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const nowIso = () => new Date().toISOString();

function generateCode6() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

async function ensureRidePool(rideId, currency = "gbp") {
  const { data: existing } = await supabase
    .from("ride_pools")
    .select("id")
    .eq("ride_id", rideId)
    .single();
  if (existing?.id) return existing.id;

  // Auto-assign booker to the ride creator
  const { data: rideRow, error: rideErr } = await supabase
    .from("rides")
    .select("user_id")
    .eq("id", rideId)
    .single();
  if (rideErr) throw new Error("Ride not found: " + rideErr.message);

  const { data: created, error } = await supabase
    .from("ride_pools")
    .insert({
      ride_id: rideId,
      currency,
      booker_user_id: rideRow.user_id || null,
      status: "collecting",
    })
    .select("id")
    .single();
  if (error) throw new Error("Failed to create ride_pool: " + error.message);
  return created.id;
}

// If pool has no booker, assign the ride host as default booker
async function ensureDefaultBooker(rideId) {
  const { data: pool } = await supabase
    .from("ride_pools")
    .select("id, booker_user_id")
    .eq("ride_id", rideId)
    .single();
  if (!pool) return;

  if (!pool.booker_user_id) {
    const { data: ride } = await supabase
      .from("rides")
      .select("user_id")
      .eq("id", rideId)
      .single();
    if (ride?.user_id) {
      await supabase
        .from("ride_pools")
        .update({ booker_user_id: ride.user_id })
        .eq("id", pool.id);
    }
  }
}

// async function recalcAndMaybeMarkBookable(ridePoolId) {

//   const { data: contribs, error: cErr } = await supabase
//     .from("ride_pool_contributions")
//     .select(
//       "user_share_minor, platform_fee_minor, seats_reserved, backpacks_reserved, small_reserved, large_reserved, status"
//     )
//     .eq("ride_pool_id", ridePoolId);

//   if (cErr) throw new Error(cErr.message);

//   const paid = (contribs || []).filter((c) => c.status === "paid");

//   const totalUserShareMinor = paid.reduce(
//     (s, c) => s + (c.user_share_minor || 0),
//     0
//   );
//   const totalFeesMinor = paid.reduce(
//     (s, c) => s + (c.platform_fee_minor || 0),
//     0
//   );

//   const paidSeats = paid.reduce((s, c) => s + (c.seats_reserved || 0), 0);
//   const paidBackpacks = paid.reduce(
//     (s, c) => s + (c.backpacks_reserved || 0),
//     0
//   );
//   const paidSmall = paid.reduce((s, c) => s + (c.small_reserved || 0), 0);
//   const paidLarge = paid.reduce((s, c) => s + (c.large_reserved || 0), 0);

//   const { data: pool, error: pErr } = await supabase
//     .from("ride_pools")
//     .update({
//       total_reserved_seats: paidSeats,
//       total_reserved_backpacks: paidBackpacks,
//       total_reserved_small: paidSmall,
//       total_reserved_large: paidLarge,
//       total_collected_user_share_minor: totalUserShareMinor,
//       total_collected_platform_fee_minor: totalFeesMinor,
//     })
//     .eq("id", ridePoolId)
//     .select("id,status,min_contributors")
//     .single();

//   if (pErr) throw new Error(pErr.message);

//   const minSeats = pool?.min_contributors || 2;
//   if (pool.status === "collecting" && paidSeats >= minSeats) {
//     await supabase
//       .from("ride_pools")
//       .update({ status: "bookable" })
//       .eq("id", ridePoolId);
//   }
// }

// Build Uber deep link
async function recalcAndMaybeMarkBookable(ridePoolId) {
  // 1) Get all contributions for this pool
  const { data: contribs, error: cErr } = await supabase
    .from("ride_pool_contributions")
    .select(
      "user_share_minor, platform_fee_minor, seats_reserved, backpacks_reserved, small_reserved, large_reserved, status"
    )
    .eq("ride_pool_id", ridePoolId);

  if (cErr) throw new Error(cErr.message);

  // 2) Only paid rows count toward totals & quorum
  const paid = (contribs || []).filter((c) => c.status === "paid");

  const totalUserShareMinor = paid.reduce(
    (s, c) => s + (c.user_share_minor || 0),
    0
  );
  const totalFeesMinor = paid.reduce(
    (s, c) => s + (c.platform_fee_minor || 0),
    0
  );

  const paidSeats = paid.reduce((s, c) => s + (c.seats_reserved || 0), 0);
  const paidBackpacks = paid.reduce(
    (s, c) => s + (c.backpacks_reserved || 0),
    0
  );
  const paidSmall = paid.reduce((s, c) => s + (c.small_reserved || 0), 0);
  const paidLarge = paid.reduce((s, c) => s + (c.large_reserved || 0), 0);

  // 3) Fetch current pool status and min_contributors
  const { data: poolRow, error: pGetErr } = await supabase
    .from("ride_pools")
    .select("id, status, min_contributors")
    .eq("id", ridePoolId)
    .single();
  if (pGetErr) throw new Error(pGetErr.message);

  const minSeats = Math.max(2, poolRow?.min_contributors || 2);

  // 4) Compute next status without regressing advanced states
  const advancedStates = new Set([
    "checking_in",
    "ready_to_book",
    "booking",
    "booked",
    "paid",
  ]);

  let nextStatus = poolRow.status;
  if (!advancedStates.has(poolRow.status)) {
    nextStatus = paidSeats >= minSeats ? "bookable" : "collecting";
  }

  // 5) Persist totals + status in one go
  const { error: pUpdErr } = await supabase
    .from("ride_pools")
    .update({
      total_reserved_seats: paidSeats,
      total_reserved_backpacks: paidBackpacks,
      total_reserved_small: paidSmall,
      total_reserved_large: paidLarge,
      total_collected_user_share_minor: totalUserShareMinor,
      total_collected_platform_fee_minor: totalFeesMinor,
      status: nextStatus,
    })
    .eq("id", ridePoolId);

  if (pUpdErr) throw new Error(pUpdErr.message);

  // (optional) You could emit notifications when pool becomes "bookable"
}

function buildUberDeepLink(ride) {
  const base = "https://m.uber.com/ul/?action=setPickup";
  const params = new URLSearchParams();

  if (ride?.from_lat && ride?.from_lng) {
    params.append("pickup[latitude]", String(ride.from_lat));
    params.append("pickup[longitude]", String(ride.from_lng));
  }
  if (ride?.from) params.append("pickup[nickname]", ride.from.slice(0, 60));
  if (ride?.to_lat && ride?.to_lng) {
    params.append("dropoff[latitude]", String(ride.to_lat));
    params.append("dropoff[longitude]", String(ride.to_lng));
  }
  if (ride?.to) params.append("dropoff[nickname]", ride.to.slice(0, 60));

  const q = params.toString();
  return q ? `${base}&${q}` : base;
}

// Verify Stripe signature against TEST or LIVE webhook secrets
function verifyStripeSignatureOrThrow(req, stripeInstance) {
  const sig = req.headers["stripe-signature"];
  const raw = req.body;
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET_TEST,
    process.env.STRIPE_WEBHOOK_SECRET_LIVE,
    process.env.STRIPE_WEBHOOK_SECRET, // fallback
  ].filter(Boolean);
  if (secrets.length === 0)
    throw new Error("No Stripe webhook secret configured");

  let lastErr;
  for (const secret of secrets) {
    try {
      return stripeInstance.webhooks.constructEvent(raw, sig, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Stripe signature verification failed");
}

/* ---------------------- Stripe Webhook (RAW body) ---------------------- */
// Must be BEFORE express.json()
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;
    try {
      event = verifyStripeSignatureOrThrow(req, stripe);
      console.log("🔔 Stripe event:", event.type);
    } catch (err) {
      console.error("❌ Stripe signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        console.log("✅ checkout.session.completed", {
          id: session.id,
          amount_total: session.amount_total,
          metadata: session.metadata,
        });

        const contributionId = Number(session.metadata?.contribution_id);

        // 1) Mark contribution as paid
        const { data: contrib } = await supabase
          .from("ride_pool_contributions")
          .update({
            status: "paid",
            stripe_session_id: session.id,
            payment_intent_id: session.payment_intent,
            amount_total_minor: session.amount_total,
          })
          .eq("id", contributionId)
          .in("status", ["pending"])
          .select("id, ride_pool_id")
          .single();

        // If already paid, fetch pool id anyway
        let ridePoolId = contrib?.ride_pool_id;
        if (!ridePoolId) {
          const { data: lookup } = await supabase
            .from("ride_pool_contributions")
            .select("ride_pool_id")
            .eq("id", contributionId)
            .single();
          ridePoolId = lookup?.ride_pool_id;
        }
        if (!ridePoolId) {
          console.warn("No ride_pool_id for contribution", contributionId);
          return res.json({ received: true });
        }

        // 2) Recalc totals + maybe flip to bookable
        await recalcAndMaybeMarkBookable(ridePoolId);

        // 3) Receipt email with ride details + resilient logging
        let customerEmail =
          session.customer_details?.email || session.customer_email || null;

        // Fallback to profile email if needed
        if (!customerEmail && session?.metadata?.user_id) {
          try {
            const { data: prof } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", session.metadata.user_id)
              .single();
            if (prof?.email) customerEmail = prof.email;
          } catch (e) {
            console.warn("Profile email lookup failed:", e?.message || e);
          }
        }

        // Fetch ride details (no FK dependency on profiles in SELECT)
        let fromLoc = "—",
          toLoc = "—",
          date = "—",
          time = "—",
          poster = "Host";
        try {
          const rideIdMeta = Number(session.metadata?.ride_id);
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

              // Poster nickname lookup (safe even if no relationship defined)
              if (rideRow.user_id) {
                try {
                  const { data: prof2 } = await supabase
                    .from("profiles")
                    .select("nickname")
                    .eq("id", rideRow.user_id)
                    .single();
                  poster = prof2?.nickname || "Host";
                } catch (e) {
                  console.warn(
                    "Poster nickname lookup failed:",
                    e?.message || e
                  );
                }
              }
            }
          }
        } catch (e) {
          console.warn("Ride lookup for email failed:", e?.message || e);
        }

        const FROM =
          process.env.RESEND_FROM || "TabFair <onboarding@resend.dev>";
        const viewRideUrl = `${APP_ORIGIN}/splitride-confirm/${encodeURIComponent(
          String(session.metadata?.ride_id || "")
        )}`;
        const myRidesBookedUrl = `${APP_ORIGIN}/my-rides?tab=booked`;

        if (customerEmail && process.env.RESEND_API_KEY) {
          const amount = ((session.amount_total ?? 0) / 100).toFixed(2);
          const currency = String(session.currency || "gbp").toUpperCase();

          const html = `
            <div style="font-family: system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; color:#111; line-height:1.5;">
              <h2 style="margin:0 0 12px">✅ Payment confirmed</h2>
              <p style="margin:0 0 8px">Thanks for splitting your ride on <strong>TabFair</strong>!</p>

              <div style="margin:16px 0; padding:12px; border:1px solid #eee; border-radius:10px;">
                <div style="margin-bottom:6px;"><strong>From:</strong> ${fromLoc}</div>
                <div style="margin-bottom:6px;"><strong>To:</strong> ${toLoc}</div>
                <div style="margin-bottom:6px;"><strong>Date:</strong> ${date}</div>
                <div style="margin-bottom:6px;"><strong>Time:</strong> ${time}</div>
                <div style="margin-bottom:6px;"><strong>Ride host:</strong> ${poster}</div>
                <div style="margin-bottom:6px;"><strong>Amount charged:</strong> ${amount} ${currency}</div>
              </div>

              <p style="margin:0 0 14px;">We’ll notify you when your group is ready. The booker can then open Uber and complete the booking.</p>

              <div style="margin:18px 0;">
                <a href="${myRidesBookedUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;">View My Ride</a>
                <a href="${viewRideUrl}" style="display:inline-block;margin-left:10px;color:#111;text-decoration:underline;">Open ride room</a>
              </div>

              <p style="margin-top:16px; font-size:13px; color:#666">— TabFair Team</p>
            </div>
          `;

          const text = [
            "Payment confirmed on TabFair",
            "",
            `From: ${fromLoc}`,
            `To: ${toLoc}`,
            `Date: ${date}`,
            `Time: ${time}`,
            `Ride host: ${poster}`,
            `Amount charged: ${amount} ${currency}`,
            "",
            `View My Ride: ${myRidesBookedUrl}`,
            `Open ride room: ${viewRideUrl}`,
          ].join("\n");

          try {
            const sendRes = await resend.emails.send({
              from: FROM,
              to: customerEmail,
              subject: "✅ TabFair · Payment confirmed",
              html,
              text,
            });
            console.log("📧 Resend queued:", sendRes?.id || sendRes);
          } catch (e) {
            console.warn("Resend email failed:", e?.message || e);
          }
        } else {
          console.log("📧 Skipped email", {
            customerEmailPresent: !!customerEmail,
            hasResendKey: !!process.env.RESEND_API_KEY,
          });
        }
      }

      return res.json({ received: true });
    } catch (e) {
      console.error("💥 Webhook handler error:", e);
      return res.status(500).json({ error: "Internal error" });
    }
  }
);

/* ---------------------- JSON parser for normal routes ---------------------- */
app.use(express.json());

/* ---------------------- Payments: Create Checkout Session ---------------------- */
app.post("/api/payments/create-checkout-session", async (req, res) => {
  try {
    // console.log("create-checkout-session body:", req.body);

    const {
      rideId,
      userId,
      email,
      currency = "gbp",

      // NEW: reservations from client (by-kind or total)
      seatsReserved, // preferred new param
      backpacks = 0,
      small = 0,
      large = 0,
      totalItems, // for "total" luggage mode

      // Back-compat
      seats, // legacy
      groupSize: legacyGroupSize, // VERY legacy (rename to avoid redeclare)
    } = req.body;

    // ---------- Normalize seats ----------
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

    // ---------- Normalize luggage ----------
    const bReq = Math.max(0, Math.floor(Number(backpacks) || 0));
    const sReq = Math.max(0, Math.floor(Number(small) || 0));
    const lReq = Math.max(0, Math.floor(Number(large) || 0));
    const totalReq = Math.max(0, Math.floor(Number(totalItems) || 0));

    if (!rideId || !userId || !Number.isFinite(seatsReq) || seatsReq <= 0) {
      return res.status(400).json({ error: "Missing/invalid fields" });
    }

    // ---------- Ensure pool exists + still collecting ----------
    const ridePoolId = await ensureRidePool(rideId, currency);
    await ensureDefaultBooker(rideId);

    const [{ data: pool }, { data: rideRow }] = await Promise.all([
      supabase
        .from("ride_pools")
        .select(
          "id, status, min_contributors, currency, total_reserved_seats, total_reserved_backpacks, total_reserved_small, total_reserved_large"
        )
        .eq("id", ridePoolId)
        .single(),
      supabase
        .from("rides")
        .select(
          "estimated_fare, seat_limit, seats, max_passengers, backpack_count, small_suitcase_count, large_suitcase_count, luggage_limit"
        )
        .eq("id", rideId)
        .single(),
    ]);

    if (!pool) return res.status(404).json({ error: "Pool not found" });
    if (pool.status !== "collecting") {
      return res.status(400).json({ error: "Pool not collecting" });
    }

    // ---------- Capacity limits ----------
    const seatsLimit =
      Number(rideRow?.seat_limit) ||
      Number(rideRow?.seats) ||
      Number(rideRow?.max_passengers) ||
      4;

    const bLimit = Number(rideRow?.backpack_count ?? 0);
    const sLimit = Number(rideRow?.small_suitcase_count ?? 0);
    const lLimit = Number(rideRow?.large_suitcase_count ?? 0);
    const totalLimit = Number(rideRow?.luggage_limit ?? 0); // legacy total-items cap
    const hasByKindLimits = Boolean(bLimit || sLimit || lLimit);

    // Current PAID reservations (pool keeps paid totals)
    const paidSeats = Number(pool?.total_reserved_seats ?? 0);
    const paidB = Number(pool?.total_reserved_backpacks ?? 0);
    const paidS = Number(pool?.total_reserved_small ?? 0);
    const paidL = Number(pool?.total_reserved_large ?? 0);

    // Seats validation
    const rSeats = Math.max(0, seatsLimit - paidSeats);
    if (seatsReq > rSeats) {
      return res
        .status(400)
        .json({ error: `Not enough seats available. Remaining: ${rSeats}` });
    }

    // Luggage validation
    if (hasByKindLimits) {
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
      // allow client to send either totalItems OR a breakdown; prefer totalItems if present
      const reqTotal = totalReq > 0 ? totalReq : bReq + sReq + lReq;
      if (reqTotal > rTotal) {
        return res
          .status(400)
          .json({ error: `Luggage over limit. Remaining items: ${rTotal}` });
      }
    }

    // ---------- Server-enforced pricing (DYNAMIC split) ----------
    const estimate = Number(rideRow?.estimated_fare ?? 35);
    const estimateMinor = toMinor(estimate);

    // dynamicGroupSize = host(1) + already paid seats + your seats
    const dynamicGroupSize = Math.max(1 + paidSeats + seatsReq, 1);
    const perSeatMinor = Math.max(
      1,
      Math.round(estimateMinor / dynamicGroupSize)
    );
    const userShareMinor = perSeatMinor * seatsReq;

    // platform fee: 10% capped 1..8
    const platformFeeMinor = clamp(Math.round(userShareMinor * 0.1), 100, 800);

    // ---------- Insert pending contribution (with reservations) ----------
    // In "total" mode, store the total items into backpacks_reserved for accounting (others zero).
    let insBackpacks = bReq;
    let insSmall = sReq;
    let insLarge = lReq;

    if (!hasByKindLimits && totalLimit) {
      const reqTotal = totalReq > 0 ? totalReq : bReq + sReq + lReq;
      insBackpacks = reqTotal;
      insSmall = 0;
      insLarge = 0;
    }

    const { data: contrib, error: insErr } = await supabase
      .from("ride_pool_contributions")
      .insert({
        ride_pool_id: ridePoolId,
        user_id: userId,
        currency,
        user_share_minor: userShareMinor,
        platform_fee_minor: platformFeeMinor,
        seats_reserved: seatsReq,
        backpacks_reserved: insBackpacks,
        small_reserved: insSmall,
        large_reserved: insLarge,
        status: "pending",
      })
      .select("id")
      .single();

    if (insErr) {
      return res.status(400).json({ error: insErr.message });
    }

    // ---------- Stripe Checkout ----------
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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email || undefined,
      customer_creation: "if_required",
      line_items: lineItems,
      metadata: {
        ride_id: String(rideId),
        user_id: String(userId),
        contribution_id: String(contrib.id),
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
          contribution_id: String(contrib.id),
          seats_reserved: String(seatsReq),
          backpacks: String(insBackpacks),
          small: String(insSmall),
          large: String(insLarge),
        },
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
    const msg = err?.raw?.message || err?.message || "Failed to create session";
    const code = err?.type === "StripeInvalidRequestError" ? 400 : 500;
    console.error("create-checkout-session failed:", err);
    return res.status(code).json({ error: msg });
  }
});

/* ---------------------- Payments: Verify (optional for PaymentSuccess UI) ---------------------- */
app.get("/api/payments/verify", async (req, res) => {
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

/* ---------------------- Booking status (for UI) ---------------------- */
app.get("/api/rides/:rideId/booking-status", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const userId = req.query.userId || null;
    // Ensure the pool exists before returning the booking status, so the user can see accurate seat/luggage limits before attempting to pay
    // 1) Pool for this ride (might not exist yet)
    let { data: pool, error: poolErr } = await supabase
      .from("ride_pools")
      .select(
        "id, status, currency, min_contributors, " +
          "total_reserved_seats, total_reserved_backpacks, total_reserved_small, total_reserved_large, " +
          "total_collected_user_share_minor, total_collected_platform_fee_minor, " +
          "booker_user_id, booking_code, code_expires_at, code_issued_at"
      )
      .eq("ride_id", rideId)
      .maybeSingle();

    // 🔧 If no pool exists yet, create one (important!)
    console.log("🧪 checking for existing pool for ride", rideId);

    if (!pool) {
      console.log("🧪 no pool found — creating ride_pool now");
      const { data: created, error: createErr } = await supabase
        .from("rides")
        .select("user_id")
        .eq("id", rideId)
        .single();

      if (createErr || !created?.user_id) {
        console.error(
          "booking-status: ride lookup failed:",
          createErr?.message
        );
        return res.status(500).json({ error: "Ride not found" });
      }

      const { data: newPool, error: newPoolErr } = await supabase
        .from("ride_pools")
        .insert({
          ride_id: rideId,
          currency: "gbp",
          booker_user_id: created.user_id,
          status: "collecting",
        })
        .select(
          "id, status, currency, min_contributors, total_reserved_seats, total_reserved_backpacks, total_reserved_small, total_reserved_large, total_collected_user_share_minor, total_collected_platform_fee_minor, booker_user_id, booking_code, code_expires_at, code_issued_at"
        )
        .single();

      if (newPoolErr) {
        console.error(
          "❌ Failed to create ride pool:",
          newPoolErr?.message || "No data returned"
        );
        return res.status(500).json({ error: "Failed to create ride pool" });
      }

      pool = newPool; // use the freshly created pool
    }

    // 2) Ride limits (capacity + luggage)
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select(
        "seat_limit, seats, max_passengers, " +
          "backpack_count, small_suitcase_count, large_suitcase_count, " +
          "luggage_limit"
      )
      .eq("id", rideId)
      .single();

    if (rideErr) {
      console.error("booking-status ride error:", rideErr);
      return res.status(500).json({ error: "Ride fetch failed" });
    }

    // 3) Paid rows → sum seats + compute hasPaid + checked-in
    const { data: paidRows, error: paidErr } = await supabase
      .from("ride_pool_contributions")
      .select("user_id, seats_reserved, checked_in_at")
      .eq("ride_pool_id", pool.id)
      .eq("status", "paid");

    if (paidErr) {
      console.error("booking-status paid rows error:", paidErr);
      return res.status(500).json({ error: "Paid rows fetch failed" });
    }

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

    // 4) Capacity (host baseline = 1 seat)
    const capacity =
      Number(ride?.seat_limit) ||
      Number(ride?.seats) ||
      Number(ride?.max_passengers) ||
      4;

    // Remaining seats for buyers = capacity - (host(1) + already paid seats)
    const remainingSeats = Math.max(capacity - (1 + paidSeats), 0);

    // 5) Luggage remaining (based on pool totals; host luggage is not auto-counted)
    const bLimit = Number(ride?.backpack_count ?? 0);
    const sLimit = Number(ride?.small_suitcase_count ?? 0);
    const lLimit = Number(ride?.large_suitcase_count ?? 0);
    const totalLimit = Number(ride?.luggage_limit ?? 0); // legacy total-items cap

    const rB = Math.max(0, bLimit - Number(pool.total_reserved_backpacks ?? 0));
    const rS = Math.max(0, sLimit - Number(pool.total_reserved_small ?? 0));
    const rL = Math.max(0, lLimit - Number(pool.total_reserved_large ?? 0));

    const reservedTotal =
      Number(pool.total_reserved_backpacks ?? 0) +
      Number(pool.total_reserved_small ?? 0) +
      Number(pool.total_reserved_large ?? 0);
    const rTotal = Math.max(0, totalLimit - reservedTotal);

    // 🔁 Build a luggage object once (used in both response sections)
    const luggageObj =
      bLimit || sLimit || lLimit
        ? {
            mode: "byKind",
            byKind: {
              backpacks: { limit: bLimit, remaining: rB },
              small: { limit: sLimit, remaining: rS },
              large: { limit: lLimit, remaining: rL },
            },
            total: { limit: 0, remaining: 0 },
          }
        : totalLimit
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

    // ✅ Final response
    res.json({
      exists: true,

      // --- dynamic split fields used by SplitRideConfirm.jsx ---
      capacity, // total seats incl host
      paidSeats, // seats already paid (excludes host)
      remainingSeats, // capacity - (1 host + paidSeats)
      hasPaid,

      // --- status & meta ---
      status: pool.status,
      currency: pool.currency,
      minContributors: pool.min_contributors,
      paidCount,
      checkedInCount,
      isBooker,
      bookerUserId: pool.booker_user_id,

      codeActive: !!(
        pool.booking_code &&
        pool.code_expires_at &&
        new Date(pool.code_expires_at) > new Date()
      ),
      codeIssuedAt: pool.code_issued_at,
      codeExpiresAt: pool.code_expires_at,

      // 🔵 Existing detailed shape (for backward compatibility)
      capacityDetail: {
        seats: { limit: capacity, remaining: remainingSeats },
        luggage: luggageObj,
      },

      // 🟢 New alias structure (more UI-friendly)
      capacityV2: {
        seats: { limit: capacity, remaining: remainingSeats },
        luggage: luggageObj,
      },

      // 💰 Totals
      totals: {
        userShareMinor: pool.total_collected_user_share_minor,
        platformFeeMinor: pool.total_collected_platform_fee_minor,
      },
    });
  } catch (e) {
    console.error("booking-status error:", e);
    res.status(500).json({ error: "Failed to fetch booking status" });
  }
});

/* ---------------------- Booker onboarding (Connect Express) ---------------------- */
async function getOrCreateConnectAccountForUser(userId, email) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_onboarded, email")
    .eq("id", userId)
    .single();

  const existingId = profile?.stripe_connect_account_id;
  const emailToUse = email || profile?.email || undefined;

  if (existingId) {
    return {
      accountId: existingId,
      onboarded: !!profile?.stripe_connect_onboarded,
    };
  }

  const account = await stripe.accounts.create({
    type: "express",
    email: emailToUse,
    country: "GB",
    capabilities: { transfers: { requested: true } },
  });

  await supabase
    .from("profiles")
    .update({ stripe_connect_account_id: account.id })
    .eq("id", userId);

  return { accountId: account.id, onboarded: false };
}

app.post("/api/booker/onboarding-link", async (req, res) => {
  try {
    const { userId, email, returnTo } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const { accountId } = await getOrCreateConnectAccountForUser(userId, email);
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${APP_ORIGIN}/connect/refresh`,
      return_url: returnTo || `${APP_ORIGIN}/connect/return`,
      type: "account_onboarding",
    });

    res.json({ url: link.url });
  } catch (e) {
    console.error("onboarding-link error:", e);
    res.status(500).json({ error: "Failed to create onboarding link" });
  }
});

/* ---------------------- Booking: Issue check-in code (booker only) ---------------------- */
app.post("/api/rides/:rideId/issue-code", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId, ttlSeconds = 600 } = req.body; // 10 mins default

    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, booker_user_id, status")
      .eq("ride_id", rideId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found" });
    if (pool.booker_user_id !== userId) {
      return res.status(403).json({ error: "Only booker can issue code" });
    }
    if (pool.status !== "bookable" && pool.status !== "checking_in") {
      return res.status(400).json({ error: "Pool not ready for check-in" });
    }

    const code = generateCode6();
    const ttl = clamp(Number(ttlSeconds), 120, 1800); // 2–30 min
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

/* ---------------------- Booking: User check-in with code ---------------------- */
app.post("/api/rides/:rideId/check-in", async (req, res) => {
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

    // Must be a PAID contributor
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

    // Count checked-in PAID contributors
    const { data: paidRows } = await supabase
      .from("ride_pool_contributions")
      .select("id, checked_in_at")
      .eq("ride_pool_id", pool.id)
      .eq("status", "paid");

    const checkedInCount = (paidRows || []).filter(
      (r) => !!r.checked_in_at
    ).length;

    // Flip to ready_to_book if threshold met
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

/* ---------------------- Booking: Claim booker if absent ---------------------- */
app.post("/api/rides/:rideId/claim-booker", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId, graceSeconds = 180 } = req.body; // 3 mins grace

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
    if (!issuedAt) {
      return res.status(400).json({ error: "No active check-in session" });
    }
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

/* ---------------------- Booker: get Uber deep link (booker only) ---------------------- */
app.get("/api/rides/:rideId/uber-link", async (req, res) => {
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

/* ---------------------- Reimburse booker (transfer pooled user-shares) ---------------------- */
app.post("/api/rides/:rideId/confirm-booked", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);
    const { userId } = req.body; // the booker confirming

    const { data: pool } = await supabase
      .from("ride_pools")
      .select("id, status, booker_user_id, currency")
      .eq("ride_id", rideId)
      .single();
    if (!pool) return res.status(404).json({ error: "Pool not found" });

    if (pool.booker_user_id !== userId) {
      return res
        .status(403)
        .json({ error: "Only the booker can confirm booking" });
    }
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

    // Lookup booker's Connect account
    const { data: prof } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id, stripe_connect_onboarded")
      .eq("id", pool.booker_user_id)
      .single();

    if (!prof?.stripe_connect_account_id) {
      return res.status(400).json({
        error: "Booker has no Connect account",
        needs_onboarding: true,
      });
    }
    if (!prof.stripe_connect_onboarded) {
      return res
        .status(400)
        .json({ error: "Booker not fully onboarded", needs_onboarding: true });
    }

    // Create transfer to the booker's Connect account
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

/* ---------------------- Start ---------------------- */
app.listen(PORT, () =>
  console.log(
    `✅ Server running on port ${PORT}\n   Origins: ${ORIGINS.join(", ")}\n   Success/Cancel origin: ${APP_ORIGIN}`
  )
);
