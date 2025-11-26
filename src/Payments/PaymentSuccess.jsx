// src/Pages/PaymentSuccess.jsx
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const rideId = params.get("rideId");

  const [status, setStatus] = useState("Verifying payment…");
  const [details, setDetails] = useState(null);
  const [rideInfo, setRideInfo] = useState(null);

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

        let data;
        try {
          data = await res.json();
        } catch {
          const text = await res.text();
          console.error("Non-JSON response:", text);
          setStatus("❌ Verification failed (unexpected response).");
          return;
        }

        if (res.ok && data.ok) {
          setStatus("✅ Payment received successfully.");
          setDetails({
            amount: (data.amount_total ?? 0) / 100,
            currency: (data.currency || "gbp").toUpperCase(),
          });
        } else {
          setStatus(
            "⚠️ We could not verify the payment, but don’t worry — if something went wrong you won’t be charged."
          );
        }
      } catch (err) {
        console.error("verify fetch error:", err);
        setStatus("❌ Verification failed.");
      }
    })();
  }, [sessionId]);

  // Fetch ride details (to display friendly info instead of ride ID)
  useEffect(() => {
    if (!rideId) return;

    (async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("from, to, date, time")
        .eq("id", rideId)
        .single();

      if (!error && data) {
        setRideInfo(data);
      }
    })();
  }, [rideId]);

  return (
    <div
      className="payment-success-container"
      style={{ maxWidth: 640, margin: "2rem auto", textAlign: "center" }}
    >
      <h2 style={{ color: "#2ecc71" }}>🎉 Payment Successful!</h2>

      <p style={{ marginTop: 8 }}>{status}</p>

      {details && (
        <p style={{ color: "#555" }}>
          Amount paid:{" "}
          <strong>
            {details.currency} {details.amount.toFixed(2)}
          </strong>
        </p>
      )}

      {rideInfo && (
        <p style={{ marginTop: 8, fontWeight: "bold" }}>
          {rideInfo.from || "Origin"} → {rideInfo.to || "Destination"} <br />
          {rideInfo.date} at {rideInfo.time}
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 16,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link className="btn" to="/my-rides?tab=booked">
          View My Ride
        </Link>

        {rideId && (
          <Link
            className="btn btn-tertiary"
            to={`/splitride-confirm/${rideId}`}
            aria-label="Open ride room for this ride"
            title="Open ride room"
          >
            Open ride room
          </Link>
        )}
      </div>

      <p style={{ marginTop: 24, color: "#666" }}>
        Your payment has been processed. Your ride host will now be notified to
        confirm the booking. If the host does not confirm, your payment will be
        automatically refunded.
      </p>

      <Link className="btn btn-secondary" to="/" style={{ marginTop: 20 }}>
        Back to Home
      </Link>
    </div>
  );
}
