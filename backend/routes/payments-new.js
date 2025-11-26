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

      const amountMinor = Number(deposit.amount_minor || 0);
      const feeMinor = Number(deposit.platform_fee_minor || 0);
      const currency = deposit.currency || "gbp";

      if (amountMinor <= 0) {
        return res
          .status(400)
          .json({ error: "Deposit amount is invalid (<= 0)" });
      }

      const lineItems = [];

      // Seat share
      if (amountMinor > 0) {
        lineItems.push({
          price_data: {
            currency,
            product_data: {
              name: "Ride seat share",
            },
            unit_amount: amountMinor,
          },
          quantity: 1,
        });
      }

      // Platform fee
      if (feeMinor > 0) {
        lineItems.push({
          price_data: {
            currency,
            product_data: {
              name: "Platform fee",
            },
            unit_amount: feeMinor,
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
  // Stripe needs the RAW body, not JSON-parsed
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
          const depositId = depositIdRaw ? Number(depositIdRaw) : null;

          if (!depositId) break; // not our event, ignore

          // Mark the deposit as paid (idempotent)
          const { error: updErr } = await supabase
            .from("ride_deposits")
            .update({ status: "paid" })
            .eq("id", depositId)
            .eq("status", "pending"); // only if still pending

          if (updErr) {
            console.error("Failed to mark deposit as paid:", updErr);
          }
          break;
        }

        default:
          // Ignore other event types for now
          break;
      }

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

export default router;
