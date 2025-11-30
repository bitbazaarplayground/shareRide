// src/Pages/HostManageRide.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { supabase } from "../supabaseClient";
import "./StylesPages/HostManageRide.css";

function pennies(gbp) {
  return Math.round(Number(gbp || 0) * 100);
}

export default function HostManageRide() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;

  const [ride, setRide] = useState(null);
  const [requests, setRequests] = useState([]);
  const [payout, setPayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  /* ---------------------------------------------
     LOAD DASHBOARD
  --------------------------------------------- */
  useEffect(() => {
    if (!rideId) return;

    (async () => {
      try {
        setLoading(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          toast.error("Not authenticated.");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `${BACKEND}/api/rides-new/${rideId}/host-dashboard`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(json.error || "Failed to load dashboard.");
          setLoading(false);
          return;
        }

        setRide(json.ride);
        setRequests(json.requests || []);
        setPayout(json.payout || null);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load ride.");
      } finally {
        setLoading(false);
      }
    })();
  }, [rideId, BACKEND]);

  const formatGBP = (minor) => (Number(minor || 0) / 100).toFixed(2);

  /* ---------------------------------------------
     CALCULATE PER-SEAT PRICE (NEW SYSTEM)
     taxi = 4 seats, always
  --------------------------------------------- */
  const pricePerSeatMinor = useMemo(() => {
    if (!ride?.estimated_fare) return null;

    const totalFareMinor = pennies(ride.estimated_fare);
    const seatPriceMinor = Math.round(totalFareMinor / 4); // fixed 4-seat model

    return seatPriceMinor;
  }, [ride]);

  function computePlatformFee(seatMinor) {
    // < £10 → £1 flat
    if (seatMinor < 1000) return 100;
    // ≥ £10 → 10%
    return Math.round(seatMinor * 0.1);
  }

  /* ---------------------------------------------
     FARE PER REQUEST
  --------------------------------------------- */
  const farePreviewByRequestId = useMemo(() => {
    const map = {};
    if (!pricePerSeatMinor) return map;

    const platformFeePerSeat = computePlatformFee(pricePerSeatMinor);

    for (const req of requests) {
      const seats = Number(req.seats || 0);

      const seatTotal = pricePerSeatMinor * seats;
      const platformTotal = platformFeePerSeat * seats;
      const userPaysTotal = seatTotal + platformTotal;

      map[req.id] = {
        seats,
        seatMinor: pricePerSeatMinor,
        seatTotal,
        platformFeePerSeat,
        platformTotal,
        userPaysTotal,
        hostReceives: seatTotal, // no host withdrawal fee yet
      };
    }

    return map;
  }, [requests, pricePerSeatMinor]);

  /* ---------------------------------------------
     UPDATE LOCAL STATUS
  --------------------------------------------- */
  const updateLocalStatus = (requestId, status) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === requestId ? { ...req, status } : req))
    );
  };

  /* ---------------------------------------------
   HOST EDIT / DELETE
--------------------------------------------- */
  // Navigate to edit form
  const handleEdit = () => {
    navigate(`/edit-ride/${rideId}`);
  };

  // Delete ride
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this ride?")) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch(`${BACKEND}/api/rides-new/${rideId}/delete`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      return toast.error(json.error || "Failed to delete ride.");
    }

    toast.success("Ride deleted.");
    navigate("/my-rides?tab=published");
  };

  /* ---------------------------------------------
     ACCEPT REQUEST (auto-creates deposit)
  --------------------------------------------- */
  const handleAccept = async (requestId) => {
    try {
      setBusy(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return toast.error("Not authenticated.");

      const res = await fetch(
        `${BACKEND}/api/rides-new/${rideId}/requests/${requestId}/accept`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );

      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || "Failed to accept request.");
        setBusy(false);
        return;
      }

      toast.success("Request accepted. Deposit created.");
      updateLocalStatus(requestId, "accepted");

      // Reload to show deposit immediately
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      console.error(err);
      toast.error("Error accepting request.");
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------
     REJECT REQUEST
  --------------------------------------------- */
  const handleReject = async (requestId) => {
    if (!window.confirm("Reject this passenger?")) return;

    try {
      setBusy(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(
        `${BACKEND}/api/rides-new/${rideId}/requests/${requestId}/reject`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );

      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || "Reject failed.");
        setBusy(false);
        return;
      }

      toast.info("Passenger rejected.");
      updateLocalStatus(requestId, "rejected");
    } catch (err) {
      console.error(err);
      toast.error("Error rejecting request.");
    } finally {
      setBusy(false);
    }
  };

  /* ---------------------------------------------
     UI
  --------------------------------------------- */

  if (loading) return <p className="host-manage-loading">Loading…</p>;
  if (!ride) return <p className="host-manage-error">Ride not found.</p>;

  return (
    <div className="host-manage-page">
      <button
        className="host-back-btn"
        onClick={() => navigate("/my-rides?tab=published")}
      >
        ← Back to My Rides
      </button>

      <h2 className="host-title">
        Manage Ride <span className="host-title-id">#{ride.id}</span>
      </h2>

      {/* SUMMARY */}
      <div className="host-ride-card">
        <p className="host-ride-route">
          <strong>
            {ride.from} → {ride.to}
          </strong>
        </p>

        <p className="host-ride-meta">
          {ride.date} at {ride.time}
        </p>

        <p className="host-ride-meta">
          Estimated Fare (Whole Ride): <strong>£{ride.estimated_fare}</strong>
        </p>

        {pricePerSeatMinor && (
          <p className="host-ride-meta">
            Passenger Price (Per Seat):{" "}
            <strong>£{formatGBP(pricePerSeatMinor)}</strong>
          </p>
        )}

        <p className="host-ride-meta">
          Ride Status: <strong>{ride.status}</strong>
        </p>
        <div className="host-ride-actions">
          <button className="edit-ride-btn" onClick={handleEdit}>
            Edit Ride
          </button>

          <button className="delete-ride-btn" onClick={handleDelete}>
            Delete Ride
          </button>
        </div>
      </div>

      {/* REQUESTS */}
      <h3 className="host-section-title">Passenger Requests</h3>

      {requests.length === 0 ? (
        <p className="host-empty-state">No ride requests yet.</p>
      ) : (
        <ul className="host-request-list">
          {requests.map((req) => {
            const passenger = req.profile || {};
            const preview = farePreviewByRequestId[req.id] || {};
            const deposit = req.deposit;

            const depositStatus = deposit?.status || "none";

            let depositText =
              depositStatus === "pending"
                ? "Waiting for payment"
                : depositStatus === "paid"
                ? "Paid"
                : req.status === "accepted"
                ? "Deposit created"
                : "Not created";

            return (
              <li key={req.id} className="host-request-item">
                <div className="host-request-main">
                  {/* NAME */}
                  <p className="host-request-name">
                    <Link
                      to={`/profile/${req.user_id}`}
                      className="host-passenger-name-link"
                    >
                      <strong>{passenger.nickname || "Passenger"}</strong>
                    </Link>{" "}
                    ({req.seats} seat{req.seats > 1 ? "s" : ""})
                  </p>

                  {/* LUGGAGE */}
                  <p className="host-request-sub">
                    Luggage — backpack {req.luggage_backpack ?? 0}, small{" "}
                    {req.luggage_small ?? 0}, large {req.luggage_large ?? 0}
                  </p>

                  {/* PRICE */}
                  {preview.seatMinor ? (
                    <>
                      <p className="host-request-sub">
                        Seat price: £{formatGBP(preview.seatMinor)} ×{" "}
                        {preview.seats} = £{formatGBP(preview.seatTotal)}
                      </p>

                      <p className="host-request-sub">
                        Platform fee: £{formatGBP(preview.platformFeePerSeat)} ×{" "}
                        {preview.seats} = £{formatGBP(preview.platformTotal)}
                      </p>

                      <p className="host-request-sub">
                        <strong>
                          Total passenger pays: £
                          {formatGBP(preview.userPaysTotal)}
                        </strong>
                      </p>

                      <p className="host-request-sub">
                        Host receives (before withdrawal fee): £
                        {formatGBP(preview.hostReceives)}
                      </p>
                    </>
                  ) : (
                    <p className="host-request-sub">No fare available</p>
                  )}

                  {/* STATUS */}
                  <p className="host-status-pill">
                    Status:{" "}
                    <span className={`status-pill status-${req.status}`}>
                      {req.status}
                    </span>
                  </p>

                  {/* DEPOSIT */}
                  <div className="host-deposit-row">
                    <span className="host-deposit-label">Deposit:</span>
                    <span className={`status-pill deposit-${depositStatus}`}>
                      {depositText}
                    </span>

                    {deposit && (
                      <span className="host-deposit-amount">
                        Passenger paid: £
                        {formatGBP(
                          (deposit.amount_minor || 0) +
                            (deposit.platform_fee_minor || 0)
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                <div className="host-request-actions">
                  {req.status === "pending" && (
                    <>
                      <button
                        className="host-btn host-btn-accept"
                        onClick={() => handleAccept(req.id)}
                        disabled={busy}
                      >
                        Accept
                      </button>

                      <button
                        className="host-btn host-btn-reject"
                        onClick={() => handleReject(req.id)}
                        disabled={busy}
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {req.status === "accepted" && (
                    <button
                      className="host-btn host-btn-cancel"
                      onClick={() => handleReject(req.id)}
                      disabled={busy}
                    >
                      Cancel / Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
