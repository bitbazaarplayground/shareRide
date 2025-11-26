// src/Pages/HostManageRide.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { supabase } from "../supabaseClient";
import "./StylesPages/HostManageRide.css"; // create this file

function pennies(gbp) {
  return Math.round(Number(gbp || 0) * 100);
}

export default function HostManageRide() {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;

  const [ride, setRide] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // ------------------------------------------------
  // Load ride + requests
  // ------------------------------------------------
  useEffect(() => {
    if (!rideId) return;

    (async () => {
      try {
        setLoading(true);

        // 1) Load ride from Supabase
        const { data: rideData, error: rideErr } = await supabase
          .from("rides")
          .select("*, profiles(nickname, avatar_url)")
          .eq("id", rideId)
          .single();

        if (rideErr || !rideData) {
          console.error("Ride load error:", rideErr);
          toast.error("Could not load ride.");
          setLoading(false);
          return;
        }

        setRide(rideData);

        // 2) Load ride requests from backend (host-only endpoint)
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token || !BACKEND) {
          toast.error("Not authenticated or backend not configured.");
          setLoading(false);
          return;
        }

        const res = await fetch(`${BACKEND}/api/rides-new/${rideId}/requests`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          console.error("Requests load error:", json);
          toast.error(json.error || "Failed to load ride requests.");
          setRequests([]);
        } else {
          setRequests(json.requests || []);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load ride.");
      } finally {
        setLoading(false);
      }
    })();
  }, [rideId, BACKEND]);

  // ------------------------------------------------
  // Simple fare preview per request (estimate)
  // ------------------------------------------------
  const farePreviewByRequestId = useMemo(() => {
    if (!ride || !requests.length) return {};

    const estimateMinor = pennies(ride.estimated_fare || 0);
    if (!estimateMinor) return {};

    const hostSeats = Number(ride.seats ?? 1);

    const totalPassengerSeats = requests
      .filter((r) => r.status === "pending" || r.status === "accepted")
      .reduce((sum, r) => sum + Number(r.seats || 0), 0);

    const groupSize = Math.max(1, hostSeats + totalPassengerSeats);
    const seatShareMinor = Math.max(1, Math.round(estimateMinor / groupSize));

    const map = {};
    for (const r of requests) {
      const seats = Number(r.seats || 0);
      const amountMinor = seatShareMinor * seats;
      map[r.id] = {
        seatShareMinor,
        amountMinor,
      };
    }
    return map;
  }, [ride, requests]);

  const formatGBP = (minor) => (Number(minor || 0) / 100).toFixed(2);

  // ------------------------------------------------
  // Accept / Reject
  // ------------------------------------------------
  const updateRequestStatusLocal = (requestId, newStatus) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
    );
  };

  const handleAccept = async (requestId) => {
    if (!BACKEND) return toast.error("Backend not configured.");

    try {
      setBusy(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Not authenticated.");
        setBusy(false);
        return;
      }

      const res = await fetch(
        `${BACKEND}/api/rides-new/${rideId}/requests/${requestId}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || "Failed to accept request.");
        setBusy(false);
        return;
      }

      toast.success("Request accepted.");
      updateRequestStatusLocal(requestId, "accepted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to accept request.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (requestId) => {
    if (!BACKEND) return toast.error("Backend not configured.");

    if (!window.confirm("Are you sure you want to reject this request?"))
      return;

    try {
      setBusy(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Not authenticated.");
        setBusy(false);
        return;
      }

      const res = await fetch(
        `${BACKEND}/api/rides-new/${rideId}/requests/${requestId}/reject`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || "Failed to reject request.");
        setBusy(false);
        return;
      }

      toast.info("Request rejected.");
      updateRequestStatusLocal(requestId, "rejected");
    } catch (err) {
      console.error(err);
      toast.error("Failed to reject request.");
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------
  // Finalise ride → creates deposits
  // ------------------------------------------------
  const handleFinalise = async () => {
    if (!BACKEND) return toast.error("Backend not configured.");

    const acceptedCount = requests.filter(
      (r) => r.status === "accepted"
    ).length;

    if (!acceptedCount) {
      toast.warn("You need at least one accepted request to finalise.");
      return;
    }

    if (
      !window.confirm(
        "Finalise ride now? This creates deposits for accepted passengers."
      )
    ) {
      return;
    }

    try {
      setBusy(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast.error("Not authenticated.");
        setBusy(false);
        return;
      }

      const res = await fetch(`${BACKEND}/api/rides-new/${rideId}/finalise`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        toast.error(json.error || "Failed to finalise ride.");
        setBusy(false);
        return;
      }

      toast.success("Ride finalised. Deposits created.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to finalise ride.");
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

        <button
          className="host-finalise-btn"
          onClick={handleFinalise}
          disabled={busy}
          title="Create deposits for all accepted passengers"
        >
          {busy ? "Working…" : "Finalise Ride (Create Deposits)"}
        </button>
      </div>

      <h3 className="host-section-title">Passenger Requests</h3>

      {requests.length === 0 ? (
        <p className="host-empty-state">No one has requested this ride yet.</p>
      ) : (
        <ul className="host-request-list">
          {requests.map((req) => {
            const passenger = req.profiles || {};
            const preview = farePreviewByRequestId[req.id] || {};
            const amountMinor = preview.amountMinor;
            const seatShareMinor = preview.seatShareMinor;

            return (
              <li key={req.id} className="host-request-item">
                <div className="host-request-main">
                  <div>
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
                      Luggage — backpack: {req.luggage_backpack ?? 0}, small:{" "}
                      {req.luggage_small ?? 0}, large: {req.luggage_large ?? 0}
                    </p>

                    {amountMinor ? (
                      <p className="host-request-sub">
                        Est. per seat: £{formatGBP(seatShareMinor)} — Est.
                        total: £{formatGBP(amountMinor)}
                      </p>
                    ) : (
                      <p className="host-request-sub">
                        Estimated fare not available yet. Passenger will pay a
                        fair split once set.
                      </p>
                    )}

                    <p className="host-status-pill">
                      Status:{" "}
                      <span className={`status-pill status-${req.status}`}>
                        {req.status}
                      </span>
                    </p>
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
                        Cancel / Reject
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="host-footer-note">
        After you’re happy with who’s joining, click{" "}
        <strong>“Finalise Ride”</strong>. That will create deposits for each
        accepted passenger, and they’ll be able to pay from their booking
        screen.
      </p>
    </div>
  );
}
