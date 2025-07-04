import { createClient } from "@supabase/supabase-js";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { Resend } from "resend"; // ✅ Corrected import
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Supabase client (using service role key, only on backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://localhost:5173/shareRide";

app.post("/create-checkout-session", async (req, res) => {
  const { rideId, amount, user_id, email } = req.body;

  if (!rideId || !amount || !user_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "GoDutch Ride Coordination Fee",
              description: `Ride ID: ${rideId}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${FRONTEND_BASE_URL}/#/payment-success?rideId=${rideId}`,
      cancel_url: `${FRONTEND_BASE_URL}/#/splitride-confirm/${rideId}`,
    });

    // ✅ Log payment in Supabase
    const { error } = await supabase.from("payments").insert([
      {
        ride_id: rideId,
        amount,
        user_id,
        email,
      },
    ]);

    if (error) {
      console.error("Supabase logging error:", error.message);
      // Don't fail the payment redirect if logging fails
    }

    // ✅ Send email receipt to user
    try {
      await resend.emails.send({
        from: "GoDutch <noreply@godutch.dev>", // Update domain if needed
        to: email,
        subject: "Your GoDutch Payment Confirmation",
        html: `
          <h2>✅ Payment Received</h2>
          <p>Hi there,</p>
          <p>Thanks for using GoDutch! Your payment for Ride ID <strong>${rideId}</strong> was successful.</p>
          <p>Amount Paid: £${(amount / 100).toFixed(2)}</p>
          <p>If you have any issues, contact us any time.</p>
        `,
      });
    } catch (emailError) {
      console.error("Resend email failed:", emailError);
    }

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error.message);
    res.status(500).json({ error: "Payment session creation failed" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`✅ Stripe server running on port ${PORT}`));
