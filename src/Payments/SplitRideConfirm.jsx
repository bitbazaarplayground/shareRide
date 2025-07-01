import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./StylesPayment/SplitRideConfirm.css";

export default function SplitRideConfirm() {
  const { rideId } = useParams();
  const [ride, setRide] = useState(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    const fetchRide = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*, profiles(nickname)")
        .eq("id", rideId)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        setRide(null);
        return;
      }

      setRide(data);
    };

    fetchRide();
  }, [rideId]);

  if (!ride) return <p>Loading ride...</p>;

  const estimate = 35.0;
  const split = (estimate / 2).toFixed(2);
  const fee = 1.5;

  const handlePayment = async () => {
    setIsPaying(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_STRIPE_BACKEND}/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rideId: ride.id,
            amount: 150,
          }),
        }
      );

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      console.error("Payment error:", err);
      alert("Failed to initiate payment.");
      setIsPaying(false);
    }
  };

  return (
    <div className="split-confirm-container">
      <h2>Ride Split Summary</h2>
      <p>
        <strong>From:</strong> {ride.from || "Unknown"}
      </p>
      <p>
        <strong>To:</strong> {ride.to || "Unknown"}
      </p>
      <p>
        <strong>Date:</strong> {ride.date || "N/A"}
      </p>
      <p>
        <strong>Time:</strong> {ride.time || "N/A"}
      </p>
      <p>
        <strong>Estimated Fare:</strong> £{estimate}
      </p>
      <p>
        <strong>Your Share:</strong> £{split} +{" "}
        <span className="fee">GoDutch Fee £{fee}</span>
      </p>

      <button
        className="stripe-btn"
        onClick={handlePayment}
        disabled={isPaying}
      >
        {isPaying ? "Processing..." : "Proceed to Payment"}
      </button>

      <p className="after-payment-note">
        After payment, we’ll guide you to split the fare in Uber.
      </p>
    </div>
  );
}
