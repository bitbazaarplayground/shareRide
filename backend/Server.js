// backend/Server.js
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Routes

import adminRoutes from "./admin/index.js";
import bookingRouter from "./routes/booking.js";
import paymentsRouter from "./routes/payments.js";
import ridesRouter from "./routes/rides.js";

// Env + paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env that sits next to Server.js
dotenv.config();
console.log("DEBUG SUPABASE_URL:", process.env.SUPABASE_URL);

/* ---------------------- Boot checks ---------------------- */
const REQUIRED = [
  "STRIPE_SECRET_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];
REQUIRED.forEach((k) => {
  if (!process.env[k]) console.warn(`⚠️ Missing ${k} in env`);
});

// Webhook secret check
if (
  !process.env.STRIPE_WEBHOOK_SECRET &&
  !process.env.STRIPE_WEBHOOK_SECRET_TEST &&
  !process.env.STRIPE_WEBHOOK_SECRET_LIVE
) {
  console.warn("⚠️ No Stripe webhook secret configured (TEST/LIVE/fallback).");
}

/* ---------------------- Express setup ---------------------- */
const app = express();

// CORS setup: allow APP_ORIGIN (comma-separated list supported)
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

// Raw body only for Stripe webhook (must come before express.json)
app.use("/api/payments/webhook", bodyParser.raw({ type: "application/json" }));

// JSON parser for everything else
app.use(express.json());

/* ---------------------- Health route ---------------------- */
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ---------------------- Mount routes ---------------------- */
app.use("/api/payments", paymentsRouter);
app.use("/api/rides", ridesRouter);
app.use("/api", bookingRouter); // for /booker/onboarding-link
/* ---------------------- Admin routes ---------------------- */
app.use("/api/admin", adminRoutes);
/* ---------------------- Start ---------------------- */
const APP_ORIGIN = (process.env.APP_ORIGIN || "http://localhost:5173").split(
  ","
)[0];
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`   Origins: ${ORIGINS.join(", ")}`);
  console.log(`   Success/Cancel origin: ${APP_ORIGIN}`);
});
