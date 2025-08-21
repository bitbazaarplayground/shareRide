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
      setStatus("❌ Missing session ID.");
      return;
    }
    if (!BACKEND) {
      setStatus("❌ Backend not configured.");
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
          setStatus("✅ Payment confirmed!");
          setDetails({
            amount: (data.amount_total ?? 0) / 100,
            currency: (data.currency || "gbp").toUpperCase(),
            livemode: !!data.livemode,
          });
        } else {
          setStatus("❌ Could not verify payment.");
        }
      } catch (err) {
        console.error("Payment verification error:", err);
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
          Amount charged:{" "}
          <strong>
            {details.currency} {details.amount.toFixed(2)}
          </strong>{" "}
          {!details.livemode && <em>(test mode)</em>}
        </p>
      )}

      {rideId && (
        <p style={{ marginTop: 8 }}>
          Ride ID: <strong>{rideId}</strong>
        </p>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <Link className="btn" to="/my-rides?tab=contributed">
          View My Ride
        </Link>
        {rideId && (
          <Link
            className="btn btn-secondary"
            to={`/splitride-confirm/${rideId}`}
          >
            Back to This Ride
          </Link>
        )}
      </div>

      <p style={{ marginTop: 24, color: "#666", fontSize: 14 }}>
        We’ll notify you once your group is ready. The booker will be able to
        open Uber and complete the ride.
      </p>
    </div>
  );
}
