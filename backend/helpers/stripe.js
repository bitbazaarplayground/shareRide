// backend/helpers/stripe.js
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Verify Stripe webhook signature against TEST, LIVE, or fallback secret.
 * Throws an error if verification fails.
 *
 * Usage:
 *   const event = verifyStripeSignatureOrThrow(req);
 */
export function verifyStripeSignatureOrThrow(req) {
  const sig = req.headers["stripe-signature"];
  const raw = req.body;

  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET_TEST,
    process.env.STRIPE_WEBHOOK_SECRET_LIVE,
    process.env.STRIPE_WEBHOOK_SECRET, // fallback
  ].filter(Boolean);

  if (secrets.length === 0) {
    throw new Error("No Stripe webhook secret configured");
  }

  let lastErr;
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(raw, sig, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Stripe signature verification failed");
}
