// src/Pages/SplitRideConfirm.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BookingFlow from "../Components/BookingFlow/BookingFlow";
import useBookingStatus from "../hooks/useBookingStatus";
import { supabase } from "../supabaseClient";
import "./StylesPayment/SplitRideConfirm.css";

function clampInt(val, min, max) {
  const n = Math.floor(Number(val) || 0);
  return Math.max(min, Math.min(n, max));
}

export default function SplitRideConfirm() {
  const { rideId } = useParams();
  const [ride, setRide] = useState(null);
  const [isPaying, setIsPaying] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);

  // buyer inputs
  const [seats, setSeats] = useState(1);
  const [backpacks, setBackpacks] = useState(0);
  const [smallSuitcases, setSmallSuitcases] = useState(0);
  const [largeSuitcases, setLargeSuitcases] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;

  // Load ride details (incl. estimated_fare for preview only)
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
  // returns one of:
  //  A) { capacity: { seats:{limit,remaining}, luggage:{...} }, remainingSeats, hasPaid, ... }
  //  B) { capacityDetail: { luggage:{...} }, capacity:{seats:{...}}, ... }
  const { data: booking, loading: bookingLoading } = useBookingStatus(
    rideId,
    userId,
    { pollMs: 8000 }
  );

  const hasPaid = !!booking?.hasPaid;

  // Seats limits
  const seatsLimit =
    booking?.capacity?.seats?.limit ??
    booking?.capacityDetail?.seats?.limit ??
    4;

  const remainingSeats =
    booking?.capacity?.seats?.remaining ??
    booking?.remainingSeats ?? // tolerate old shape
    Math.max(seatsLimit - 0, 0);

  // Luggage limits: accept either booking.capacity.luggage or booking.capacityDetail.luggage
  const luggageRoot =
    booking?.capacity?.luggage ?? booking?.capacityDetail?.luggage ?? null;

  const luggageMode = luggageRoot?.mode || "none"; // "byKind" | "total" | "none"

  const remB = luggageRoot?.byKind?.backpacks?.remaining ?? 0;
  const remS = luggageRoot?.byKind?.small?.remaining ?? 0;
  const remL = luggageRoot?.byKind?.large?.remaining ?? 0;
  const remTotal = luggageRoot?.total?.remaining ?? 0;

  // Keep seats within valid range when status changes
  useEffect(() => {
    setSeats((prev) =>
      clampInt(prev || 1, 1, Math.max(1, remainingSeats || 1))
    );
  }, [remainingSeats]);

  // Clamp luggage on remaining changes
  useEffect(() => {
    if (luggageMode === "byKind") {
      setBackpacks((v) => clampInt(v, 0, Math.max(0, remB)));
      setSmallSuitcases((v) => clampInt(v, 0, Math.max(0, remS)));
      setLargeSuitcases((v) => clampInt(v, 0, Math.max(0, remL)));
      setTotalItems(0);
    } else if (luggageMode === "total") {
      setTotalItems((v) => clampInt(v, 0, Math.max(0, remTotal)));
      setBackpacks(0);
      setSmallSuitcases(0);
      setLargeSuitcases(0);
    } else {
      // none
      setBackpacks(0);
      setSmallSuitcases(0);
      setLargeSuitcases(0);
      setTotalItems(0);
    }
  }, [luggageMode, remB, remS, remL, remTotal]);

  // Estimate for display (fallback only)
  const estimate = useMemo(() => {
    const val = Number(ride?.estimated_fare ?? 35);
    return Number.isFinite(val) ? val : 35;
  }, [ride]);

  // paidSeats approximation: seatsLimit - remainingSeats
  const paidSeats = Math.max(0, seatsLimit - (remainingSeats ?? 0));

  // Dynamic per-seat preview: host(1) + paidSeats + seatsSelected
  const perSeatPreview = useMemo(() => {
    const groupSize = Math.max(1 + paidSeats + (seats || 1), 1);
    return estimate / groupSize;
  }, [estimate, paidSeats, seats]);

  // Luggage validation (client-side UI guard; server re-validates)
  const luggageValid = useMemo(() => {
    if (luggageMode === "byKind") {
      if (backpacks > remB) return false;
      if (smallSuitcases > remS) return false;
      if (largeSuitcases > remL) return false;
      return true;
    }
    if (luggageMode === "total") {
      return totalItems <= remTotal;
    }
    return true; // no luggage constraints
  }, [
    luggageMode,
    backpacks,
    smallSuitcases,
    largeSuitcases,
    totalItems,
    remB,
    remS,
    remL,
    remTotal,
  ]);

  const luggageError =
    !luggageValid &&
    (luggageMode === "byKind"
      ? `Not enough luggage capacity. Remaining — Backpacks: ${remB}, Small: ${remS}, Large: ${remL}.`
      : `Not enough luggage capacity. Remaining total items: ${remTotal}.`);

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
    if (remainingSeats <= 0) {
      alert("This ride is at capacity.");
      return;
    }
    if (seats < 1) {
      alert("Please select at least 1 seat.");
      return;
    }
    if (!luggageValid) {
      alert(luggageError || "Your luggage exceeds the remaining capacity.");
      return;
    }

    setIsPaying(true);
    try {
      const body = {
        rideId: ride.id,
        userId,
        email: userEmail,
        currency: "gbp",
        // send both for compatibility with current backend
        seatsReserved: seats,
        seats,
      };

      if (luggageMode === "byKind") {
        body.backpacks = backpacks;
        body.small = smallSuitcases;
        body.large = largeSuitcases;
      } else if (luggageMode === "total") {
        body.totalItems = totalItems;
      }

      const response = await fetch(
        `${BACKEND}/api/payments/create-checkout-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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

  const dynamicTotal = (perSeatPreview * Math.max(1, seats)).toFixed(2);

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
          Price is split across everyone traveling. The host counts as{" "}
          <strong>1 seat</strong>. The more seats you add now, the lower the{" "}
          <strong>per-seat</strong> price.
        </p>
        <p style={{ color: "#555" }}>
          Current per seat (preview):{" "}
          <strong>£{perSeatPreview.toFixed(2)}</strong>
        </p>
        <p style={{ color: "#777", fontSize: 13, marginTop: 4 }}>
          Final amount is calculated on the server at checkout. A small platform
          fee applies.
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
              ? `${remainingSeats} seat(s) available (capacity ${seatsLimit})`
              : "No seats available"}
          </span>
        </div>
      </div>

      {/* Luggage controls */}
      {console.log("Luggage render check:", { luggageMode, remB, remS, remL })}
      {luggageMode !== "none" && (
        <div className="split-controls" style={{ marginTop: 16 }}>
          <label>
            <strong>Your luggage:</strong>{" "}
            <span className="cap-note" style={{ fontWeight: 400 }}>
              {luggageMode === "byKind"
                ? `Remaining — Backpacks ${remB}, Small ${remS}, Large ${remL}`
                : `Remaining total items: ${remTotal}`}
            </span>
          </label>

          {luggageMode === "byKind" ? (
            <div className="luggage-grid">
              <div className="luggage-field">
                <label htmlFor="lg-backpacks">Backpacks</label>
                <input
                  id="lg-backpacks"
                  type="number"
                  min={0}
                  max={Math.max(0, remB)}
                  value={backpacks}
                  onChange={(e) =>
                    setBackpacks(clampInt(e.target.value, 0, Math.max(0, remB)))
                  }
                />
              </div>
              <div className="luggage-field">
                <label htmlFor="lg-small">Small suitcases</label>
                <input
                  id="lg-small"
                  type="number"
                  min={0}
                  max={Math.max(0, remS)}
                  value={smallSuitcases}
                  onChange={(e) =>
                    setSmallSuitcases(
                      clampInt(e.target.value, 0, Math.max(0, remS))
                    )
                  }
                />
              </div>
              <div className="luggage-field">
                <label htmlFor="lg-large">Large suitcases</label>
                <input
                  id="lg-large"
                  type="number"
                  min={0}
                  max={Math.max(0, remL)}
                  value={largeSuitcases}
                  onChange={(e) =>
                    setLargeSuitcases(
                      clampInt(e.target.value, 0, Math.max(0, remL))
                    )
                  }
                />
              </div>
            </div>
          ) : (
            <div className="luggage-grid">
              <div className="luggage-field">
                <label htmlFor="lg-total">Total luggage items</label>
                <input
                  id="lg-total"
                  type="number"
                  min={0}
                  max={Math.max(0, remTotal)}
                  value={totalItems}
                  onChange={(e) =>
                    setTotalItems(
                      clampInt(e.target.value, 0, Math.max(0, remTotal))
                    )
                  }
                />
              </div>
            </div>
          )}

          {luggageMode !== "none" && !luggageValid && (
            <p className="error" role="alert" style={{ marginTop: 6 }}>
              {luggageError}
            </p>
          )}
        </div>
      )}

      <p style={{ marginTop: 16 }}>
        <strong>Your total (preview):</strong> £{dynamicTotal}{" "}
        <span className="fee"> + platform fee</span>
      </p>

      <button
        className="stripe-btn"
        onClick={handlePayment}
        disabled={
          isPaying ||
          hasPaid ||
          bookingLoading ||
          remainingSeats <= 0 ||
          !luggageValid
        }
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
