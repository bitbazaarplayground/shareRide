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

  // Booking lock countdown
  const [lockRemaining, setLockRemaining] = useState(null);

  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;

  // Load ride details (for preview only)
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

  // 🔒 Request a booking lock immediately on arrival
  useEffect(() => {
    if (!rideId || !userId || !BACKEND) return;

    let interval;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) {
          console.warn("No Supabase token, cannot lock seat");
          return;
        }

        const resp = await fetch(`${BACKEND}/api/rides/${rideId}/lock-seat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          console.error("Lock-seat error:", json);
          return;
        }

        if (json.expiresAt) {
          const expiry = new Date(json.expiresAt).getTime();
          const update = () => {
            const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
            setLockRemaining(diff);
          };
          update(); // start immediately
          interval = setInterval(update, 1000);
        }
      } catch (e) {
        console.error("Lock-seat fetch failed:", e);
      }
    })();

    return () => clearInterval(interval);
  }, [rideId, userId, BACKEND]);

  // Live booking status (poll every 8s)
  const { data: booking, loading: bookingLoading } = useBookingStatus(
    rideId,
    userId,
    { pollMs: 8000 }
  );

  const hasPaid = !!booking?.hasPaid;

  // If backend reports a new lock expiry, sync countdown
  useEffect(() => {
    if (!booking?.lock?.expiresAt) return;
    const expiry = new Date(booking.lock.expiresAt).getTime();

    const update = () => {
      const diff = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      setLockRemaining(diff);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [booking?.lock?.expiresAt]);

  // --- Capacity handling ---
  const seatsLimit =
    booking?.capacity?.seats?.limit ??
    booking?.capacityDetail?.seats?.limit ??
    4;

  const remainingSeats =
    booking?.capacity?.seats?.remaining ??
    booking?.remainingSeats ??
    Math.max(seatsLimit - 0, 0);

  const luggageRoot =
    booking?.capacity?.luggage ?? booking?.capacityDetail?.luggage ?? null;
  const luggageMode = luggageRoot?.mode || "none";

  const remB = luggageRoot?.byKind?.backpacks?.remaining ?? 0;
  const remS = luggageRoot?.byKind?.small?.remaining ?? 0;
  const remL = luggageRoot?.byKind?.large?.remaining ?? 0;
  const remTotal = luggageRoot?.total?.remaining ?? 0;

  // Clamp seats/luggage on capacity updates
  useEffect(() => {
    setSeats((prev) =>
      clampInt(prev || 1, 1, Math.max(1, remainingSeats || 1))
    );
  }, [remainingSeats]);

  useEffect(() => {
    if (luggageMode === "byKind") {
      setBackpacks((v) => clampInt(v, 0, remB));
      setSmallSuitcases((v) => clampInt(v, 0, remS));
      setLargeSuitcases((v) => clampInt(v, 0, remL));
      setTotalItems(0);
    } else if (luggageMode === "total") {
      setTotalItems((v) => clampInt(v, 0, remTotal));
      setBackpacks(0);
      setSmallSuitcases(0);
      setLargeSuitcases(0);
    } else {
      setBackpacks(0);
      setSmallSuitcases(0);
      setLargeSuitcases(0);
      setTotalItems(0);
    }
  }, [luggageMode, remB, remS, remL, remTotal]);

  // --- Pricing preview ---
  const estimate = useMemo(() => {
    const val = Number(ride?.estimated_fare ?? 35);
    return Number.isFinite(val) ? val : 35;
  }, [ride]);

  const paidSeats = Math.max(0, seatsLimit - (remainingSeats ?? 0));

  const perSeatPreview = useMemo(() => {
    const groupSize = Math.max(1 + paidSeats + (seats || 1), 1);
    return estimate / groupSize;
  }, [estimate, paidSeats, seats]);

  const dynamicTotal = (perSeatPreview * Math.max(1, seats)).toFixed(2);

  // --- Luggage validation ---
  const luggageValid = useMemo(() => {
    if (luggageMode === "byKind") {
      return (
        backpacks <= remB && smallSuitcases <= remS && largeSuitcases <= remL
      );
    }
    if (luggageMode === "total") {
      return totalItems <= remTotal;
    }
    return true;
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

  // --- Handle payment ---
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
    if (lockRemaining !== null && lockRemaining <= 0) {
      alert("Booking time has expired. Please try booking again.");
      window.location.href = "/all-rides";
      return;
    }

    setIsPaying(true);
    try {
      const body = {
        rideId: ride.id,
        userId,
        email: userEmail,
        currency: "gbp",
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

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${BACKEND}/api/payments/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`, // ✅ Required
          },
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

  // --- Render ---
  if (!ride) return <p>Loading ride...</p>;
  if (userId === null) return <p>Loading account…</p>;
  if (!userId) return <p>Please sign in to view this ride.</p>;

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

          {!luggageValid && (
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

      {/* Lock countdown timer */}
      {lockRemaining !== null && (
        <div style={{ marginTop: 12 }}>
          {lockRemaining > 0 ? (
            <p
              style={{
                color: "#444",
                fontWeight: 500,
              }}
            >
              ⏳ You have {Math.floor(lockRemaining / 60)}m {lockRemaining % 60}
              s to complete checkout
            </p>
          ) : (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "red", fontWeight: 600 }}>
                ⚠️ Booking time has expired. Please try booking again.
              </p>
              <button
                onClick={() => (window.location.href = "/all-rides")}
                style={{
                  marginTop: 8,
                  padding: "10px 16px",
                  background: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                🔙 Back to All Rides
              </button>
            </div>
          )}
        </div>
      )}

      <button
        className="stripe-btn"
        onClick={handlePayment}
        disabled={
          isPaying ||
          hasPaid ||
          bookingLoading ||
          remainingSeats <= 0 ||
          !luggageValid ||
          (lockRemaining !== null && lockRemaining <= 0)
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
