// backend/routes/booking.js
import express from "express";
import { supabase } from "../supabaseClient.js";

import { stripe } from "../helpers/stripe.js";

const router = express.Router();

/* ---------------------- Booker onboarding (Stripe Connect) ---------------------- */
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

  // Create new Connect Express account
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

router.post("/booker/onboarding-link", async (req, res) => {
  try {
    const { userId, email, returnTo } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const { accountId } = await getOrCreateConnectAccountForUser(userId, email);
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.APP_ORIGIN}/connect/refresh`,
      return_url: returnTo || `${process.env.APP_ORIGIN}/connect/return`,
      type: "account_onboarding",
    });

    res.json({ url: link.url });
  } catch (e) {
    console.error("onboarding-link error:", e);
    res.status(500).json({ error: "Failed to create onboarding link" });
  }
});

export default router;
