// src/Pages/SplitRideConfirm.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BookingFlow from "../Components/BookingFlow/BookingFlow";
import useBookingStatus from "../hooks/useBookingStatus";
import { supabase } from "../supabaseClient";
import "./StylesPayment/SplitRideConfirm.css";

export default function SplitRideConfirm() {
  const { rideId } = useParams();
  const [ride, setRide] = useState(null);
  const [isPaying, setIsPaying] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [groupSize, setGroupSize] = useState(2);

  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;

  // Load ride details
  useEffect(() => {
    (async () => {
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
    })();
  }, [rideId]);

  // Load user info
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        setUserEmail(data.user.email);
      } else {
        setUserId(""); // not logged in
      }
    })();
  }, []);

  // Use backend booking-status (includes hasPaid now)
  const { status: booking, loading: bookingLoading } = useBookingStatus(
    rideId,
    userId,
    { pollMs: 8000 }
  );
  const hasPaid = !!booking?.hasPaid;

  // Pricing
  const estimate = useMemo(() => {
    const val = Number(ride?.estimated_fare ?? 35);
    return Number.isFinite(val) ? val : 35;
  }, [ride]);

  const maxByRide = Number(ride?.max_passengers || ride?.seats_total || 4) || 4;
  const maxSplit = Math.min(4, Math.max(2, maxByRide));

  useEffect(() => {
    setGroupSize((prev) => Math.min(Math.max(prev, 2), maxSplit));
  }, [maxSplit]);

  const userShare = useMemo(
    () => Number((estimate / groupSize).toFixed(2)),
    [estimate, groupSize]
  );

  const platformFee = useMemo(() => {
    const pct = Number((userShare * 0.1).toFixed(2));
    return Math.max(1, Math.min(8, pct));
  }, [userShare]);

  if (!ride) return <p>Loading ride...</p>;
  if (userId === null) return <p>Loading account…</p>;
  if (!userId) return <p>Please sign in to view this ride.</p>;

  const handlePayment = async () => {
    if (!BACKEND) {
      alert("Payment backend is not configured (VITE_STRIPE_BACKEND).");
      return;
    }
    if (hasPaid) {
      alert("You’ve already paid for this ride.");
      return;
    }

    setIsPaying(true);
    try {
      const response = await fetch(
        `${BACKEND}/api/payments/create-checkout-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rideId: ride.id,
            userId,
            email: userEmail,
            currency: "gbp",
            userShare,
            platformFee,
            groupSize,
          }),
        }
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const { url } = await response.json();
      if (!url) throw new Error("No Checkout URL returned");
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

      <div className="split-controls">
        <label htmlFor="groupSize">
          <strong>People splitting:</strong>
        </label>
        <div className="segmented">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              className={`seg-btn ${groupSize === n ? "active" : ""}`}
              onClick={() => setGroupSize(n)}
              disabled={n > maxSplit}
              aria-pressed={groupSize === n}
            >
              {n}
            </button>
          ))}
          {maxSplit < 4 && (
            <span className="cap-note">
              Capacity limits this to {maxSplit}.
            </span>
          )}
        </div>
      </div>

      <p>
        <strong>Estimated Fare:</strong> £{estimate.toFixed(2)}
      </p>
      <p>
        <strong>Your Share:</strong> £{userShare.toFixed(2)} +{" "}
        <span className="fee">Platform Fee £{platformFee.toFixed(2)}</span>
      </p>

      <button
        className="stripe-btn"
        onClick={handlePayment}
        disabled={isPaying || hasPaid || bookingLoading}
      >
        {hasPaid
          ? "Already Paid"
          : isPaying
            ? "Processing..."
            : "Proceed to Payment"}
      </button>

      <p className="after-payment-note">
        After payment, we’ll guide the booker to open Uber and complete the
        booking.
      </p>

      <div style={{ marginTop: 24 }}>
        <BookingFlow
          rideId={rideId}
          userId={userId}
          isAuthenticated={!!userId}
        />
      </div>
    </div>
  );
}
