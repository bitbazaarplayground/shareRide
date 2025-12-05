// src/Pages/PaymentSuccess.jsx

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./StylesPayment/PaymentSuccess.css";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const rideId = params.get("rideId");

  const [status, setStatus] = useState("Verifying payment…");
  const [details, setDetails] = useState(null);
  const [rideInfo, setRideInfo] = useState(null);
  const [checkinCode, setCheckinCode] = useState(null);

  // 1️⃣ Verify payment
  useEffect(() => {
    const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;
    if (!sessionId || !BACKEND) {
      setStatus("❌ Something went wrong. Please contact support.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${BACKEND}/api/payments-new/verify?session_id=${encodeURIComponent(
            sessionId
          )}`
        );

        const data = await res.json();

        if (res.ok && data.ok) {
          setStatus("✅ Payment received successfully.");
          setDetails({
            amount: (data.amount_total ?? 0) / 100,
            currency: (data.currency || "gbp").toUpperCase(),
          });
        } else {
          setStatus(
            "⚠️ We could not verify the payment, but don’t worry — you will not be charged."
          );
        }
      } catch (err) {
        console.error("verify fetch error:", err);
        setStatus("❌ Verification failed.");
      }
    })();
  }, [sessionId]);

  // 2️⃣ Load ride details
  useEffect(() => {
    if (!rideId) return;

    (async () => {
      const { data } = await supabase
        .from("rides")
        .select("from, to, date, time")
        .eq("id", rideId)
        .single();

      if (data) setRideInfo(data);
    })();
  }, [rideId]);

  // 3️⃣ Load the check-in code (Passenger should see it immediately)
  useEffect(() => {
    if (!rideId) return;

    (async () => {
      const user = supabase.auth.getUser();
      const { data: depositRows } = await supabase
        .from("ride_deposits")
        .select("checkin_code, request_id")
        .eq("ride_id", rideId)
        .eq("user_id", (await user).data.user?.id);

      if (depositRows?.length > 0) {
        setCheckinCode(depositRows[0].checkin_code || null);
      }
    })();
  }, [rideId]);

  return (
    <div className="payment-success-wrapper">
      <h2 className="payment-success-title">🎉 Payment Successful!</h2>

      <p className="payment-success-status">{status}</p>

      {details && (
        <p className="payment-success-amount">
          Amount Paid: {details.currency} {details.amount.toFixed(2)}
        </p>
      )}

      {rideInfo && (
        <p className="payment-success-rideinfo">
          <strong>{rideInfo.from}</strong> → <strong>{rideInfo.to}</strong>
          <br />
          {rideInfo.date} at {rideInfo.time}
        </p>
      )}

      {/*  ⭐ SHOW CHECK-IN CODE IF AVAILABLE ⭐ */}
      {checkinCode && (
        <div className="payment-success-checkin-box">
          <p className="payment-success-checkin-title">Your Check-In Code:</p>
          <p className="payment-success-checkin-code">{checkinCode}</p>

          <p className="payment-success-redirect-note">
            Show this code to your host at pickup.
          </p>
        </div>
      )}

      <div className="payment-success-actions">
        <Link className="btn" to="/my-rides?tab=booked">
          View My Ride
        </Link>

        {rideId && (
          <Link
            className="btn btn-tertiary"
            to={`/splitride-confirm/${rideId}`}
          >
            Open Ride Room
          </Link>
        )}
      </div>

      <p className="payment-success-redirect-note">
        Your host will now be notified that you paid. If the host cancels, you
        will be automatically refunded.
      </p>

      <Link className="btn btn-secondary" to="/" style={{ marginTop: "1rem" }}>
        Back to Home
      </Link>
    </div>
  );
}
