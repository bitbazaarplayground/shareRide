import "dotenv/config";

import cors from "cors";
import express from "express";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

app.post("/create-checkout-session", async (req, res) => {
  const { rideId, amount } = req.body;

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
            unit_amount: amount, // in pence
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `http://localhost:5173/payment-success?rideId=${rideId}`,
      cancel_url: `http://localhost:5173/splitride-confirm/${rideId}`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () =>
  console.log("Stripe server running on http://localhost:3000")
);
