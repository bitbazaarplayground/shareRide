// backend/routes/payments-new.js
import express from "express";
import { stripe } from "../helpers/stripe.js";
import { supabase } from "../supabaseClient.js";

const router = express.Router();

/* ---------------------- Pick correct webhook secret ---------------------- */
function getWebhookSecret() {
  return (
    process.env.STRIPE_WEBHOOK_SECRET ||
    process.env.STRIPE_WEBHOOK_SECRET_TEST ||
    process.env.STRIPE_WEBHOOK_SECRET_LIVE
  );
}

/* ---------------------- Origin picker (for success/cancel URLs) --------- */
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

/* ========================================================================
   1. GET MY DEPOSIT FOR A RIDE
   ------------------------------------------------------------------------
   GET /api/payments-new/deposits/:rideId/mine
   Auth: Bearer <passenger token>

   → Lets the frontend know if this user already has a deposit row
=========================================================================== */
router.get("/deposits/:rideId/mine", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing token" });
    }

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { data: deposit, error: depErr } = await supabase
      .from("ride_deposits")
      .select(
        "id, ride_id, user_id, request_id, amount_minor, platform_fee_minor, currency, status"
      )
      .eq("ride_id", rideId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (depErr) {
      console.error("get my deposit error:", depErr);
      return res.status(500).json({ error: "Failed to load deposit" });
    }

    // If null → no deposit yet
    return res.json({ ok: true, deposit: deposit || null });
  } catch (err) {
    console.error("get my deposit error:", err);
    return res.status(500).json({ error: "Failed to load deposit" });
  }
});

/* ========================================================================
   2. CREATE CHECKOUT SESSION FOR A DEPOSIT
   ------------------------------------------------------------------------
   POST /api/payments-new/deposits/:depositId/create-session
   Auth: Bearer <passenger token>

   Body: { email?: string }
=========================================================================== */

router.post(
  "/deposits/:depositId/create-session",
  express.json(),
  async (req, res) => {
    try {
      const depositId = Number(req.params.depositId);
      const { email: bodyEmail } = req.body || {};

      // ===== Auth =====
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (!token) {
        return res.status(401).json({ error: "Missing token" });
      }

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser(token);

      if (userErr || !user) {
        return res.status(401).json({ error: "Invalid token" });
      }

      // ===== Load deposit =====
      const { data: deposit, error: depErr } = await supabase
        .from("ride_deposits")
        .select(
          "id, ride_id, user_id, amount_minor, platform_fee_minor, currency, status"
        )
        .eq("id", depositId)
        .single();

      if (depErr || !deposit) {
        return res.status(404).json({ error: "Deposit not found" });
      }

      if (deposit.user_id !== user.id) {
        return res.status(403).json({ error: "Not your deposit" });
      }

      if (deposit.status !== "pending") {
        return res.status(400).json({ error: "Deposit is not pending" });
      }

      const seatMinor = Number(deposit.amount_minor || 0);
      const platformMinor = Number(deposit.platform_fee_minor || 0);

      if (seatMinor <= 0) {
        return res.status(400).json({ error: "Invalid deposit amount" });
      }

      const currency = deposit.currency || "gbp";

      /* ----------------------------------------------
        Build Stripe line items:
        - Seat Price
        - Platform Fee
      ---------------------------------------------- */
      const lineItems = [
        {
          price_data: {
            currency,
            product_data: {
              name: "Seat Price",
            },
            unit_amount: seatMinor,
          },
          quantity: 1,
        },
      ];

      if (platformMinor > 0) {
        lineItems.push({
          price_data: {
            currency,
            product_data: {
              name: "Platform Fee",
            },
            unit_amount: platformMinor,
          },
          quantity: 1,
        });
      }

      const APP_ORIGIN = getAppOrigin();

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: bodyEmail || user.email || undefined,
        line_items: lineItems,
        metadata: {
          deposit_id: String(deposit.id),
          ride_id: String(deposit.ride_id),
          user_id: String(deposit.user_id),
        },
        success_url: `${APP_ORIGIN}/payment-success?session_id={CHECKOUT_SESSION_ID}&rideId=${encodeURIComponent(
          String(deposit.ride_id)
        )}`,
        cancel_url: `${APP_ORIGIN}/splitride-confirm/${encodeURIComponent(
          String(deposit.ride_id)
        )}?canceled=true`,
      });

      return res.json({ ok: true, url: session.url });
    } catch (err) {
      console.error("create deposit checkout session failed:", err);
      return res.status(500).json({ error: "Failed to create session" });
    }
  }
);

/* ========================================================================
   3. STRIPE WEBHOOK (NEW)
   ------------------------------------------------------------------------
   POST /api/payments-new/webhook
   - Configure this URL in Stripe Dashboard
   - Use the same signing secret vars as before
=========================================================================== */
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = getWebhookSecret();

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          const depositIdRaw = session.metadata?.deposit_id;
          const rideIdRaw = session.metadata?.ride_id;

          const depositId = depositIdRaw ? Number(depositIdRaw) : null;
          const rideId = rideIdRaw ? Number(rideIdRaw) : null;

          if (!depositId || !rideId) break;

          /* -----------------------------------------------------
             1. Mark deposit as PAID (idempotent)
          ----------------------------------------------------- */
          const { error: updErr } = await supabase
            .from("ride_deposits")
            .update({
              status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", depositId)
            .eq("status", "pending");

          if (updErr) {
            console.error("Failed to mark deposit as paid:", updErr);
            break;
          }
          /* -----------------------------------------------------
     1B. Generate passenger check-in code
  ----------------------------------------------------- */
          function generateCode() {
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            let out = "";
            for (let i = 0; i < 6; i++) {
              out += chars[Math.floor(Math.random() * chars.length)];
            }
            return out;
          }

          const code = generateCode();

          // Optional expiry (3 hours after ride start)
          const { data: rideRowForCode } = await supabase
            .from("rides")
            .select("date, time")
            .eq("id", rideId)
            .single();

          let expiresAt = null;

          if (rideRowForCode?.date && rideRowForCode?.time) {
            // Normalise time string — ensure format HH:MM:SS
            let safeTime = rideRowForCode.time;

            // If time is only "HH:MM", append ":00"
            if (safeTime.length === 5) {
              safeTime = safeTime + ":00";
            }

            // If time is empty or invalid, skip expiry
            if (!safeTime || safeTime.length < 8) {
              console.warn(
                "⚠️ WEBHOOK: Invalid ride time, skipping expiry generation:",
                safeTime
              );
            } else {
              const rideDateTime = new Date(
                `${rideRowForCode.date}T${safeTime}`
              );

              if (!isNaN(rideDateTime.getTime())) {
                expiresAt = new Date(
                  rideDateTime.getTime() + 3 * 60 * 60 * 1000
                ).toISOString();
              } else {
                console.warn("⚠️ WEBHOOK: Could not parse rideDateTime:", {
                  date: rideRowForCode.date,
                  safeTime,
                });
              }
            }
          }

          // Update deposit with code + expiry
          const { data: codeUpdate, error: codeErr } = await supabase
            .from("ride_deposits")
            .update({
              checkin_code: code,
              checkin_code_expires_at: expiresAt,
            })
            .eq("id", depositId)
            .select();

          console.log("WEBHOOK code update result:", {
            depositId,
            code,
            expiresAt,
            codeUpdate,
            codeErr,
          });

          if (codeErr) {
            console.error("❌ Failed to set check-in code:", codeErr);
          }

          /* -----------------------------------------------------
             2. Load ALL deposits for this ride
          ----------------------------------------------------- */
          const { data: allDeposits, error: depErr } = await supabase
            .from("ride_deposits")
            .select("status, amount_minor, platform_fee_minor")
            .eq("ride_id", rideId);

          if (depErr || !allDeposits) {
            console.error("Failed loading deposits:", depErr);
            break;
          }

          const totalDeposits = allDeposits.length;
          const paidDeposits = allDeposits.filter(
            (d) => d.status === "paid"
          ).length;

          // Not all deposits complete → stop here
          if (paidDeposits !== totalDeposits) break;

          console.log("All deposits paid for ride", rideId);

          /* -----------------------------------------------------
             3. Create ride_payout record (if not existing)
          ----------------------------------------------------- */
          const { data: existingPayout } = await supabase
            .from("ride_payouts")
            .select("id")
            .eq("ride_id", rideId)
            .maybeSingle();

          if (!existingPayout) {
            const totalSeatMinor = allDeposits.reduce(
              (sum, d) => sum + Number(d.amount_minor || 0),
              0
            );
            const totalPlatformMinor = allDeposits.reduce(
              (sum, d) => sum + Number(d.platform_fee_minor || 0),
              0
            );

            const hostFeeMinor = 50; // £0.50 withdrawal fee
            const hostPayoutMinor = totalSeatMinor - hostFeeMinor;
            const platformEarningsMinor = totalPlatformMinor + hostFeeMinor;

            // Load ride host
            const { data: rideRow } = await supabase
              .from("rides")
              .select("user_id")
              .eq("id", rideId)
              .single();

            if (!rideRow) {
              console.error("Ride not found for payout creation.");
              break;
            }

            const payoutInsert = {
              ride_id: rideId,
              host_user_id: rideRow.user_id,
              currency: "gbp",
              total_seat_minor: totalSeatMinor,
              total_platform_minor: totalPlatformMinor,
              host_fee_minor: hostFeeMinor,
              host_payout_minor: hostPayoutMinor,
              platform_earnings_minor: platformEarningsMinor,
              status: "pending",
              created_at: new Date().toISOString(),
            };

            const { error: payoutErr } = await supabase
              .from("ride_payouts")
              .insert(payoutInsert);

            if (payoutErr) {
              console.error("Failed to create payout:", payoutErr);
            } else {
              console.log("Payout record created for ride", rideId);
            }
          }

          break;
        }

        default:
          break;
      }

      // Acknowledge webhook to Stripe
      res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler failed:", err);
      return res.status(500).send("Webhook handler error");
    }
  }
);

/* ========================================================================
   4. VERIFY SESSION (Frontend calls this after redirect)
=========================================================================== */
router.get("/verify", async (req, res) => {
  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id" });
    }

    // Fetch session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return res.json({
      ok: true,
      amount_total: session.amount_total,
      currency: session.currency,
      payment_status: session.payment_status,
      deposit_id: session.metadata?.deposit_id,
      ride_id: session.metadata?.ride_id,
      user_id: session.metadata?.user_id,
    });
  } catch (err) {
    console.error("verify session error:", err);
    return res.status(500).json({ error: "Failed to verify session" });
  }
});
/* ========================================================================
   5. AUTO NO-SHOW + AUTO-PAYOUT READY (cron)
   ------------------------------------------------------------------------
   GET /api/payments-new/auto-noshow
   Called by GitHub Actions every 5 minutes.

   - Marks passengers as "no_show" if not checked-in 10 min after ride start
   - Marks ride as "ready_for_payout"
   - Ensures payout row exists and is pending
=========================================================================== */
router.get("/auto-noshow", async (req, res) => {
  try {
    const cronKey = req.headers["x-cron-secret"];
    if (!cronKey || cronKey !== process.env.CRON_SECRET_NOSHOW) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const now = Date.now();
    const GRACE_MINUTES = 10;

    // 1. Load rides currently in or near check-in state
    const { data: rides, error: rideErr } = await supabase
      .from("rides")
      .select("id, user_id, status, date, time")
      .in("status", ["checking_in", "in_progress"])
      .order("id");

    if (rideErr) throw rideErr;

    let processed = 0;

    for (const ride of rides) {
      const rideStart = new Date(`${ride.date}T${ride.time}`);
      const cutoff = rideStart.getTime() + GRACE_MINUTES * 60 * 1000;

      // Skip future rides or ones still inside grace window
      if (now < cutoff) continue;

      const rideId = ride.id;

      // 2. Get all accepted passengers for this ride
      const { data: requests } = await supabase
        .from("ride_requests")
        .select("id, user_id, seats, status, checked_in_at")
        .eq("ride_id", rideId)
        .eq("status", "accepted");

      // 3. Mark missing passengers as no-show
      for (const req of requests) {
        if (!req.checked_in_at) {
          await supabase
            .from("ride_requests")
            .update({ status: "no_show" })
            .eq("id", req.id);
        }
      }

      // 4. Ensure payout row exists
      const { data: payoutRow } = await supabase
        .from("ride_payouts")
        .select("id, host_payout_status")
        .eq("ride_id", rideId)
        .maybeSingle();

      if (!payoutRow) {
        // Create a payout entry with pending host payout
        const { error: insertErr } = await supabase
          .from("ride_payouts")
          .insert({
            ride_id: rideId,
            host_user_id: ride.user_id,
            host_payout_status: "pending",
            total_seat_minor: 0,
            total_platform_minor: 0,
            withdrawal_fee_minor: 50,
            host_receives_minor: 0,
            platform_earnings_minor: 0,
            updated_at: new Date().toISOString(),
          });

        if (insertErr) throw insertErr;
      } else if (payoutRow.host_payout_status !== "paid") {
        // Ensure status remains pending
        await supabase
          .from("ride_payouts")
          .update({
            host_payout_status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", payoutRow.id);
      }

      // 5. Set ride to ready_for_payout
      await supabase
        .from("rides")
        .update({ status: "ready_for_payout" })
        .eq("id", rideId);

      processed++;
    }

    return res.json({ ok: true, processed });
  } catch (err) {
    console.error("auto-noshow cron error:", err);
    return res.status(500).json({ error: "auto-noshow failed" });
  }
});

/* ========================================================================
   6. HOST WITHDRAW EARNINGS FOR A RIDE
   ------------------------------------------------------------------------
   POST /api/payments-new/payouts/:rideId/withdraw
   Auth: Host only
=========================================================================== */

router.post("/payouts/:rideId/withdraw", async (req, res) => {
  try {
    const rideId = Number(req.params.rideId);

    /* ------------------- Auth ------------------- */
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) return res.status(401).json({ error: "Missing token" });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user)
      return res.status(401).json({ error: "Invalid token" });

    const hostUserId = user.id;

    /* ------------------- Load ride ------------------- */
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .select("id, user_id, status, date, time")
      .eq("id", rideId)
      .single();

    if (rideErr || !ride)
      return res.status(404).json({ error: "Ride not found" });

    if (ride.user_id !== hostUserId)
      return res.status(403).json({ error: "Not your ride" });

    /* ------------------- Load payout row ------------------- */
    const { data: payout, error: payErr } = await supabase
      .from("ride_payouts")
      .select("*")
      .eq("ride_id", rideId)
      .maybeSingle();

    if (payErr)
      return res.status(500).json({ error: "Failed to load payout row" });

    if (!payout)
      return res.status(404).json({
        error:
          "No payout record exists for this ride. Deposits may not be finalized yet.",
      });

    if (payout.status === "paid")
      return res.status(400).json({ error: "Payout already completed." });

    if (payout.status !== "awaiting_withdrawal") {
      return res.status(400).json({
        error:
          "Payout is not yet available. Ensure all passengers checked in or no-shows processed.",
      });
    }

    /* ------------------- Stripe Connected Account Check ------------------- */
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("stripe_connect_account_id")
      .eq("user_id", hostUserId)
      .single();

    if (profErr || !profile)
      return res.status(500).json({ error: "Failed to load host profile" });

    if (!profile.stripe_connect_account_id) {
      return res.status(400).json({
        error:
          "Host does not have a Stripe connected account. Please complete onboarding.",
      });
    }

    const connectId = profile.stripe_connect_account_id;

    /* ------------------- Calculate payout details ------------------- */
    const withdrawalFeeMinor = payout.withdrawal_fee_minor ?? 50; // 50p default
    const totalSeatMinor = Number(payout.total_seat_minor || 0);

    if (totalSeatMinor <= 0)
      return res.status(400).json({ error: "No funds available to withdraw" });

    const hostReceivesMinor = totalSeatMinor - withdrawalFeeMinor;

    if (hostReceivesMinor <= 0)
      return res.status(400).json({
        error: "Payout amount is zero after fees. Cannot withdraw.",
      });

    /* ------------------- Create Stripe transfer ------------------- */
    const transfer = await stripe.transfers.create({
      amount: hostReceivesMinor,
      currency: payout.currency || "gbp",
      destination: connectId,
      metadata: {
        ride_id: rideId,
        host_user_id: hostUserId,
      },
    });

    /* ------------------- Mark payout as completed ------------------- */
    const { error: updErr } = await supabase
      .from("ride_payouts")
      .update({
        status: "paid",
        stripe_transfer_id: transfer.id,
        paid_at: new Date().toISOString(),
      })
      .eq("id", payout.id);

    if (updErr)
      return res.status(500).json({ error: "Failed to mark payout as paid." });

    return res.json({
      ok: true,
      transfer_id: transfer.id,
      amount_minor: hostReceivesMinor,
    });
  } catch (err) {
    console.error("withdraw endpoint failed:", err);
    return res.status(500).json({ error: "Failed to withdraw payout" });
  }
});

export default router;
