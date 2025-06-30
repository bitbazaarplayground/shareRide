import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./StylesPayment/SplitRideConfirm.css";

export default function SplitRideConfirm() {
  const { rideId } = useParams();
  const [ride, setRide] = useState(null);

  useEffect(() => {
    const fetchRide = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*, profiles(nickname)")
        .eq("id", rideId)
        .single();

      if (!error) setRide(data);
    };

    fetchRide();
  }, [rideId]);

  if (!ride) return <p>Loading ride...</p>;

  // Basic fake estimate for now
  const estimate = 35.0;
  const split = (estimate / 2).toFixed(2);
  const fee = 1.5;
  const handlePayment = async () => {
    try {
      const response = await fetch(
        "http://localhost:3000/create-checkout-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rideId: ride.id,
            amount: 150, // £1.50 in pence
          }),
        }
      );

      const { url } = await response.json();
      window.location.href = url;
    } catch (err) {
      console.error("Payment error:", err);
      alert("Failed to initiate payment.");
    }
  };

  return (
    <div className="split-confirm-container">
      <h2>Ride Split Summary</h2>
      <p>
        <strong>From:</strong> {ride.from}
      </p>
      <p>
        <strong>To:</strong> {ride.to}
      </p>
      <p>
        <strong>Date:</strong> {ride.date}
      </p>
      <p>
        <strong>Time:</strong> {ride.time}
      </p>
      <p>
        <strong>Estimated Fare:</strong> £{estimate}
      </p>
      <p>
        <strong>Your Share:</strong> £{split} +{" "}
        <span className="fee">GoDutch Fee £{fee}</span>
      </p>

      <button className="stripe-btn" onClick={handlePayment}>
        Proceed to Payment
      </button>

      <p className="after-payment-note">
        After payment, we’ll guide you to split the fare in Uber.
      </p>
    </div>
  );
}
