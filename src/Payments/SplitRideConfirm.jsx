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

  // remove lockRemaining, lockLoading, expiresAt entirely
  // (new system has no locks)

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

  const safeFormat = (val) =>
    Number.isFinite(val) ? (val / 100).toFixed(2) : "0.00";

  // Live booking status (poll every 8s)
  const { data: booking, loading: bookingLoading } = useBookingStatus(
    rideId,
    userId,
    {
      pollMs: 8000,
      seats, // optional for preview
    }
  );

  const hasPaid = !!booking?.hasPaid;

  // --- Capacity handling ---
  const seatsLimit =
    booking?.capacity?.seats?.limit ??
    booking?.capacityDetail?.seats?.limit ??
    4;

  const hostSeats = Number(ride?.seats ?? 1);

  const remainingSeats =
    (booking?.capacity?.seats?.limit ?? seatsLimit) -
    hostSeats -
    (booking?.paidSeats ?? 0);

  const luggageRoot =
    booking?.capacity?.luggage ?? booking?.capacityDetail?.luggage ?? null;

  const remB = Math.max(luggageRoot?.byKind?.backpacks?.remaining ?? 0, 0);
  const remS = Math.max(luggageRoot?.byKind?.small?.remaining ?? 0, 0);
  const remL = Math.max(luggageRoot?.byKind?.large?.remaining ?? 0, 0);

  const luggageMode = luggageRoot?.mode ?? "none";
  const remTotal = luggageRoot?.total?.remaining ?? 0;

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
  const pennies = (gbp) => Math.round(Number(gbp || 0) * 100);

  const estimateMinor = useMemo(() => {
    const fromBackend = Number(booking?.estimateMinor ?? 0);
    if (Number.isFinite(fromBackend) && fromBackend > 0) return fromBackend;
    return pennies(ride?.estimated_fare ?? 35);
  }, [booking?.estimateMinor, ride?.estimated_fare]);

  const hostSeatsFixed = Number(ride?.seats ?? 1);
  const paidSeatsFixed = Number(booking?.paidSeats ?? 0);

  const perSeatPreviewMinor = useMemo(() => {
    const groupSize = Math.max(
      hostSeatsFixed + paidSeatsFixed + (seats || 1),
      1
    );
    return Math.max(1, Math.round(estimateMinor / groupSize));
  }, [estimateMinor, hostSeatsFixed, paidSeatsFixed, seats]);

  const dynamicTotal = useMemo(() => {
    return safeFormat(perSeatPreviewMinor * Math.max(1, seats));
  }, [perSeatPreviewMinor, seats]);

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

  // ============================================================
  // ✅ NEW PAYMENT FLOW — NO LOCKS — USE REQUEST + POLLING
  // ============================================================
  const handlePayment = async () => {
    if (!BACKEND) {
      alert("Payment backend is not configured.");
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("You must be logged in to book this ride.");
      return;
    }

    // 1️⃣ Create or reuse request
    const requestRes = await fetch(
      `${BACKEND}/api/rides-new/${rideId}/request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          seats,
          luggage: {
            backpack: backpacks,
            small: smallSuitcases,
            large: largeSuitcases,
          },
        }),
      }
    );

    const requestJson = await requestRes.json();

    if (!requestRes.ok || !requestJson.ok) {
      alert(requestJson.error || "Could not create ride request.");
      return;
    }

    const requestId = requestJson.requestId;

    // 2️⃣ Poll Supabase for deposit row
    let depositId = null;

    for (let i = 0; i < 10; i++) {
      const { data } = await supabase
        .from("ride_deposits")
        .select("id, request_id")
        .eq("request_id", requestId)
        .maybeSingle();

      if (data?.id) {
        depositId = data.id;
        break;
      }

      await new Promise((res) => setTimeout(res, 300));
    }

    if (!depositId) {
      alert("Deposit not created yet. Ask the ride host to finalise the ride.");
      return;
    }

    // 3️⃣ Create Stripe session
    const checkoutRes = await fetch(
      `${BACKEND}/api/payments-new/deposits/${depositId}/create-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: userEmail,
        }),
      }
    );

    const checkoutJson = await checkoutRes.json();

    if (!checkoutRes.ok || !checkoutJson.ok) {
      alert(checkoutJson.error || "Failed to create Stripe session.");
      return;
    }

    // 4️⃣ Redirect
    window.location.href = checkoutJson.url;
  };

  // helper: calculate platform fee
  const calcPlatformFee = (totalMinor) => {
    const feeMinor = Math.min(Math.max(Math.round(totalMinor * 0.1), 100), 800);
    return feeMinor;
  };

  const subtotalMinor = perSeatPreviewMinor * seats;
  const feeMinor = calcPlatformFee(subtotalMinor);
  const totalWithFee = ((subtotalMinor + feeMinor) / 100).toFixed(2);

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
          Price is split across everyone traveling. The more seats you add now,
          the lower the <strong>per-seat</strong> price.
        </p>

        <p style={{ marginTop: 16 }}>
          <strong>
            Your total<sup style={{ fontSize: "0.8em" }}>*</sup>:
          </strong>{" "}
          £{dynamicTotal}{" "}
          <span className="fee">
            + £{(feeMinor / 100).toFixed(2)} platform fee
          </span>
        </p>

        <p style={{ color: "#555" }}>
          Per seat (preview):{" "}
          <strong>£{safeFormat(perSeatPreviewMinor)}</strong>
        </p>

        <p style={{ color: "#777", fontSize: 13, marginTop: 4 }}>
          Final amount is calculated on the server at checkout. A small platform
          fee applies.
        </p>
      </div>

      {/* Seats selector */}
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

      {/* Luggage section */}
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

      {/* Total */}
      <p style={{ marginTop: 16 }}>
        <strong>
          Your total<sup style={{ fontSize: "0.8em" }}>*</sup>:
        </strong>{" "}
        £{totalWithFee}
      </p>

      {/* Submit */}
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

      <p className="footnote">
        * Final price may vary slightly depending on Uber’s final fare.
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
