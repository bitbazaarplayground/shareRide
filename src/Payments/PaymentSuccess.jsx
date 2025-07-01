// PaymentSuccess.jsx
import { useSearchParams } from "react-router-dom";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const rideId = params.get("rideId");

  return (
    <div className="payment-success-container">
      <h2>✅ Payment Successful!</h2>
      <p>
        You’ve confirmed your ride split for ride ID: <strong>{rideId}</strong>
      </p>
      <p>Please ask your co-rider to open Uber and split fare after booking.</p>
      <a
        href="https://m.uber.com/ul/?action=setPickup"
        target="_blank"
        rel="noreferrer"
        className="uber-deep-link"
      >
        Open Uber
      </a>
    </div>
  );
}
