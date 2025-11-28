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

  // ------------------------------------------------
  // Load ride + requests + deposits + payout
  // ------------------------------------------------
  useEffect(() => {
    if (!rideId) return;

    (async () => {
      try {
        setLoading(true);

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token || !BACKEND) {
          toast.error("Not authenticated or backend missing.");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `${BACKEND}/api/rides-new/${rideId}/host-dashboard`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const json = await res.json();
        if (!res.ok || !json.ok) {
          toast.error(json.error || "Failed to load ride dashboard.");
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

  // ------------------------------------------------
  // Fare preview (if estimated fare exists)
  // ------------------------------------------------
  const farePreviewByRequestId = useMemo(() => {
    if (!ride || !requests.length) return {};

    const rideEstimateMinor = pennies(ride.estimated_fare || 0);
    if (!rideEstimateMinor) return {};

    const hostSeats = Number(ride.seats ?? 1);

    const passengerSeats = requests
      .filter((r) => ["pending", "accepted"].includes(r.status))
      .reduce((sum, r) => sum + Number(r.seats || 0), 0);

    const totalPeople = Math.max(1, hostSeats + passengerSeats);
    const seatShareMinor = Math.max(
      1,
      Math.round(rideEstimateMinor / totalPeople)
    );

    const out = {};
    for (const r of requests) {
      const s = Number(r.seats || 0);
      out[r.id] = {
        seatShareMinor,
        amountMinor: seatShareMinor * s,
      };
    }
    return out;
  }, [ride, requests]);

  const updateLocalStatus = (requestId, status) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === requestId ? { ...req, status } : req))
    );
  };

  // ------------------------------------------------
  // Accept Request  → backend auto-creates deposit
  // ------------------------------------------------
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
        toast.error(json.error || "Accept failed.");
        setBusy(false);
        return;
      }

      toast.success("Request accepted. Deposit created automatically.");
      updateLocalStatus(requestId, "accepted");

      // Reload to fetch newly created deposit
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      console.error(err);
      toast.error("Could not accept request.");
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------
  // Reject Request
  // ------------------------------------------------
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
      toast.error("Could not reject request.");
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------
  // UI
  // ------------------------------------------------
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

      {/* TOP SUMMARY CARD */}
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
          Estimated fare:{" "}
          <strong>£{Number(ride.estimated_fare || 0).toFixed(2)}</strong>
        </p>
        <p className="host-ride-meta">
          Ride Status: <strong>{ride.status}</strong>
        </p>

        {payout && (
          <p className="host-ride-meta">
            Host payout: <strong>{payout.status}</strong>{" "}
            {payout.host_payout_minor != null && (
              <>— est. £{formatGBP(payout.host_payout_minor)}</>
            )}
          </p>
        )}
      </div>

      <h3 className="host-section-title">Passenger Requests</h3>

      {requests.length === 0 ? (
        <p className="host-empty-state">No ride requests yet.</p>
      ) : (
        <ul className="host-request-list">
          {requests.map((req) => {
            const passenger = req.profile || {};
            const preview = farePreviewByRequestId[req.id] || {};
            const deposit = req.deposit;

            let depositText = "Not created";
            let depositClass = "none";

            if (!deposit) {
              depositText =
                req.status === "pending"
                  ? "Pending approval"
                  : req.status === "accepted"
                  ? "Deposit created automatically"
                  : "Not created";
            } else {
              if (deposit.status === "pending") {
                depositText = "Waiting for passenger to pay";
                depositClass = "pending";
              } else if (deposit.status === "paid") {
                depositText = "Paid";
                depositClass = "paid";
              } else {
                depositText = deposit.status;
                depositClass = deposit.status;
              }
            }

            return (
              <li key={req.id} className="host-request-item">
                <div className="host-request-main">
                  <p className="host-request-name">
                    <Link
                      to={`/profile/${req.user_id}`}
                      className="host-passenger-name-link"
                    >
                      <strong>{passenger.nickname || "Passenger"}</strong>
                    </Link>{" "}
                    ({req.seats} seat{req.seats > 1 ? "s" : ""})
                  </p>

                  <p className="host-request-sub">
                    Luggage: backpack {req.luggage_backpack ?? 0}, small{" "}
                    {req.luggage_small ?? 0}, large {req.luggage_large ?? 0}
                  </p>

                  {preview.amountMinor ? (
                    <p className="host-request-sub">
                      Est. per seat: £{formatGBP(preview.seatShareMinor)} — Est.
                      total: £{formatGBP(preview.amountMinor)}
                    </p>
                  ) : (
                    <p className="host-request-sub">
                      Estimated fare not set yet.
                    </p>
                  )}

                  <p className="host-status-pill">
                    Status:{" "}
                    <span className={`status-pill status-${req.status}`}>
                      {req.status}
                    </span>
                  </p>

                  {/* Deposit row */}
                  <div className="host-deposit-row">
                    <span className="host-deposit-label">Deposit:</span>
                    <span className={`status-pill deposit-${depositClass}`}>
                      {depositText}
                    </span>

                    {deposit && (
                      <span className="host-deposit-amount">
                        £
                        {formatGBP(
                          (deposit.amount_minor || 0) +
                            (deposit.platform_fee_minor || 0)
                        )}
                      </span>
                    )}
                  </div>
                </div>

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
