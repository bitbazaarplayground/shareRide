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

  // Reservations the buyer wants
  const [seats, setSeats] = useState(1);
  const [backpacks, setBackpacks] = useState(0);
  const [small, setSmall] = useState(0);
  const [large, setLarge] = useState(0);

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

  // Live booking status (server-calculated)
  const { status: booking, loading: bookingLoading } = useBookingStatus(
    rideId,
    userId,
    { pollMs: 8000 }
  );

  const hasPaid = !!booking?.hasPaid;
  const minContrib = booking?.minContributors || 2;
  const perSeatMinor = booking?.perSeatMinor || 0;
  const remainingSeats = booking?.remainingSeats ?? Math.max(minContrib - 0, 0);

  // Estimate for display (fallback only)
  const estimate = useMemo(() => {
    const val = Number(ride?.estimated_fare ?? 35);
    return Number.isFinite(val) ? val : 35;
  }, [ride]);

  // Per-seat preview if backend not ready yet
  const perSeatPreview =
    perSeatMinor > 0
      ? perSeatMinor / 100
      : Number((estimate / Math.max(2, minContrib)).toFixed(2));

  // Keep seats within valid range when availability updates
  useEffect(() => {
    if (!Number.isFinite(remainingSeats)) return;
    setSeats((prev) => {
      const x = Math.max(1, Math.min(prev || 1, Math.max(1, remainingSeats)));
      return x;
    });
  }, [remainingSeats]);

  // Hints from ride limits (UI hints only; server enforces true remaining)
  const seatLimit =
    Number(ride?.seat_limit) ||
    Number(ride?.seats) ||
    Number(ride?.max_passengers) ||
    4;

  const bLimit = Number(ride?.backpack_count ?? 0);
  const sLimit = Number(ride?.small_suitcase_count ?? 0);
  const lLimit = Number(ride?.large_suitcase_count ?? 0);
  const totalLimit = Number(ride?.luggage_limit ?? 0);

  if (!ride) return <p>Loading ride...</p>;
  if (userId === null) return <p>Loading account…</p>;
  if (!userId) return <p>Please sign in to view this ride.</p>;

  const clampInt = (n, min, max) => {
    const v = Math.floor(Number(n) || 0);
    return Math.max(min, Math.min(max, v));
  };

  const handlePayment = async () => {
    if (!BACKEND) {
      alert("Payment backend is not configured (VITE_STRIPE_BACKEND).");
      return;
    }
    if (hasPaid) {
      alert("You’ve already paid for this ride.");
      return;
    }
    if (remainingSeats <= 0) {
      alert("This ride’s pool is already full.");
      return;
    }
    if (seats < 1) {
      alert("Please select at least 1 seat.");
      return;
    }

    // Light client-side sanity (UI hints only; server enforces actual remaining)
    if (seatLimit && seats > seatLimit) {
      alert(`This vehicle allows up to ${seatLimit} seats.`);
      return;
    }
    if (totalLimit) {
      const totalReq = backpacks + small + large;
      if (totalReq > totalLimit) {
        alert(`Total luggage exceeds this ride’s limit (${totalLimit} items).`);
        return;
      }
    } else {
      if (bLimit && backpacks > bLimit) {
        alert(`Backpacks exceed limit (${bLimit}).`);
        return;
      }
      if (sLimit && small > sLimit) {
        alert(`Small suitcases exceed limit (${sLimit}).`);
        return;
      }
      if (lLimit && large > lLimit) {
        alert(`Large suitcases exceed limit (${lLimit}).`);
        return;
      }
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
            seatsReserved: seats, // server prefers seatsReserved
            backpacks,
            small,
            large,
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
      alert(err?.message || "Failed to initiate payment.");
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

      {/* Price explanation */}
      <div className="price-box">
        <p style={{ marginBottom: 8 }}>
          Price is <strong>per seat</strong>, based on a target group of{" "}
          <strong>{minContrib}</strong> seats.
        </p>
        <p style={{ color: "#555" }}>
          Per seat: <strong>£{perSeatPreview.toFixed(2)}</strong>
        </p>
        <p style={{ color: "#777", fontSize: 13, marginTop: 4 }}>
          (Unit price stays fixed; once {minContrib} seats are paid, the ride
          becomes bookable.)
        </p>
      </div>

      {/* Seats the buyer needs */}
      <div className="split-controls">
        <label htmlFor="seats">
          <strong>Seats you need:</strong>
        </label>
        <div className="segmented">
          <input
            id="seats"
            type="number"
            min={1}
            max={Math.max(1, remainingSeats || 1)}
            value={seats}
            onChange={(e) =>
              setSeats(
                clampInt(e.target.value, 1, Math.max(1, remainingSeats || 1))
              )
            }
            aria-label="Seats you need"
          />
          <span className="cap-note">
            {remainingSeats > 0
              ? `${remainingSeats} seat(s) left before booking can start`
              : "Pool is full"}
          </span>
        </div>
      </div>

      {/* Luggage the buyer brings */}
      <div className="luggage-controls">
        <p>
          <strong>Your luggage:</strong>{" "}
          <span style={{ color: "#666", fontSize: 13 }}>
            (Server enforces remaining capacity)
          </span>
        </p>
        <div className="luggage-grid">
          <label htmlFor="backpacks">Backpacks</label>
          <input
            id="backpacks"
            type="number"
            min={0}
            value={backpacks}
            onChange={(e) => setBackpacks(clampInt(e.target.value, 0, 99))}
          />
          {bLimit ? (
            <span className="hint">Ride limit: {bLimit}</span>
          ) : (
            <span className="hint">&nbsp;</span>
          )}

          <label htmlFor="small">Small suitcases</label>
          <input
            id="small"
            type="number"
            min={0}
            value={small}
            onChange={(e) => setSmall(clampInt(e.target.value, 0, 99))}
          />
          {sLimit ? (
            <span className="hint">Ride limit: {sLimit}</span>
          ) : (
            <span className="hint">&nbsp;</span>
          )}

          <label htmlFor="large">Large suitcases</label>
          <input
            id="large"
            type="number"
            min={0}
            value={large}
            onChange={(e) => setLarge(clampInt(e.target.value, 0, 99))}
          />
          {lLimit ? (
            <span className="hint">Ride limit: {lLimit}</span>
          ) : (
            <span className="hint">&nbsp;</span>
          )}
        </div>

        {totalLimit ? (
          <p className="cap-note">
            Total luggage items allowed for this ride: {totalLimit}
          </p>
        ) : null}
      </div>

      <p>
        <strong>
          Your <em>estimated</em> total:
        </strong>{" "}
        £{(perSeatPreview * Math.max(1, seats)).toFixed(2)}{" "}
        <span className="fee"> + platform fee</span>
      </p>

      <button
        className="stripe-btn"
        onClick={handlePayment}
        disabled={isPaying || hasPaid || bookingLoading || remainingSeats <= 0}
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
