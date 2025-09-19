// src/Pages/PaymentSuccess.jsx
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const rideId = params.get("rideId");
  const [status, setStatus] = useState("Verifying payment…");
  const [details, setDetails] = useState(null);

  useEffect(() => {
    const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;

    if (!sessionId) {
      setStatus("❌ Missing session id.");
      return;
    }
    if (!BACKEND) {
      setStatus("❌ Backend not configured (VITE_STRIPE_BACKEND).");
      return;
    }

    (async () => {
      try {
        const res = await fetch(
          `${BACKEND}/api/payments/verify?session_id=${encodeURIComponent(
            sessionId
          )}`
        );
        const data = await res.json();
        if (res.ok && data.ok) {
          // Map reason into human text
          let message = "";
          if (data.reason === "paid") {
            message = "✅ Payment captured!";
          } else if (data.reason === "requires_capture") {
            message = "✅ Payment authorized";
          } else if (data.reason === "succeeded") {
            message = "✅ Payment succeeded.";
          } else {
            message = `✅ Payment confirmed (status: ${data.reason})`;
          }

          setStatus(message);
          setDetails({
            amount: (data.amount_total ?? 0) / 100,
            currency: (data.currency || "gbp").toUpperCase(),
            livemode: !!data.livemode,
          });
        } else {
          setStatus(
            `❌ Could not verify payment. ${
              data?.reason ? `Reason: ${data.reason}` : ""
            }`
          );
        }
      } catch (err) {
        console.error("verify fetch error:", err);
        setStatus("❌ Verification failed.");
      }
    })();
  }, [sessionId]);

  return (
    <div
      className="payment-success-container"
      style={{ maxWidth: 640, margin: "2rem auto" }}
    >
      <h2>✅ Payment Successful!</h2>

      <p style={{ marginTop: 8 }}>{status}</p>

      {details && (
        <p style={{ color: "#555" }}>
          Amount authorized:{" "}
          <strong>
            {details.currency} {details.amount.toFixed(2)}
          </strong>
        </p>
      )}

      {rideId && (
        <p style={{ marginTop: 8 }}>
          Ride ID: <strong>{rideId}</strong>
        </p>
      )}

      <div
        style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}
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

      <p style={{ marginTop: 16, color: "#666" }}>
        Funds are pre-authorized. Final capture will happen once the group is
        ready and the ride is booked in Uber. Any unused buffer will be
        automatically refunded.
      </p>
      <Link className="btn btn-secondary" to="/">
        Back to Home
      </Link>
    </div>
  );
}
