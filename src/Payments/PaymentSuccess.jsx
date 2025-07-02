import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const rideId = params.get("rideId");
  const [status, setStatus] = useState("Logging payment...");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const logPayment = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        setStatus("❌ Could not identify user.");
        return;
      }

      setUser(userId);

      const { error } = await supabase.from("payments").insert([
        {
          ride_id: rideId,
          user_id: userId,
          amount: 150, // assuming it's always £1.50
        },
      ]);

      if (error) {
        console.error("Failed to log payment:", error.message);
        setStatus("❌ Failed to log payment.");
      } else {
        setStatus("✅ Payment logged successfully.");
      }
    };

    logPayment();
  }, [rideId]);

  return (
    <div className="payment-success-container">
      <h2>✅ Payment Successful!</h2>
      <p>
        You’ve confirmed your ride split for ride ID: <strong>{rideId}</strong>
      </p>
      <p>{status}</p>
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
