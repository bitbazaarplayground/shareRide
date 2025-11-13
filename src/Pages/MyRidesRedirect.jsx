// src/Pages/MyRidesRedirect.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmModal from "../Components/ConfirmModal";
import RideCard from "../Components/RideCard";
import { useAuth } from "../Contexts/AuthContext";
import useTabQueryParam from "../hooks/useTabQueryParam";
import { supabase } from "../supabaseClient";
import "./StylesPages/MyRidesRedirect.css";

// Booking flow widgets (active rides only)
import CheckInPanel from "../Components/BookingFlow/CheckInPanel";
import ConfirmBookedButton from "../Components/BookingFlow/ConfirmBookedButton";
import IssueCodePanel from "../Components/BookingFlow/IssueCodePanel";

const TABS = ["published", "saved", "booked"];

export default function MyRidesRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // keep ?tab= in sync
  const { activeTab, changeTab } = useTabQueryParam(TABS, "published");

  const [publishedRides, setPublishedRides] = useState([]);
  const [savedRides, setSavedRides] = useState([]);
  const [bookedRides, setBookedRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rideToDelete, setRideToDelete] = useState(null);

  //Timer Countdown
  // for live countdown timer
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!user) return;

    const fetchPublishedRides = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*, ride_pools(id, confirm_by, status)")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (!error) {
        // 🔧 Normalize ride_pools into an array
        const normalized = (data || []).map((r) => ({
          ...r,
          ride_pools: Array.isArray(r.ride_pools)
            ? r.ride_pools
            : [r.ride_pools],
        }));
        setPublishedRides(normalized);
      }
    };

    const fetchSavedRides = async () => {
      const { data, error } = await supabase
        .from("saved_rides")
        .select("rides(*, profiles(*))")
        .eq("user_id", user.id);
      if (!error) setSavedRides((data || []).map((entry) => entry.rides));
    };

    // Booked rides from ride_pool_contributions (status=paid)
    const fetchBookedRides = async () => {
      // 1) user’s paid contributions
      const { data: contribs, error: cErr } = await supabase
        .from("ride_pool_contributions")
        .select(
          "id, ride_pool_id, user_share_minor, platform_fee_minor, checked_in_at, status, is_host, booking_code, lost_host"
        )
        .eq("user_id", user.id)
        .in("status", ["pending", "paid"]);

      if (cErr) {
        console.warn("contribs error:", cErr);
        setBookedRides([]);
        return;
      }
      if (!contribs || contribs.length === 0) {
        setBookedRides([]);
        return;
      }

      // 2) pools for those contributions
      const poolIds = [...new Set(contribs.map((c) => c.ride_pool_id))];
      const { data: pools, error: pErr } = await supabase
        .from("ride_pools")
        .select("id, ride_id, status, min_contributors, confirm_by")
        .in("id", poolIds);

      if (pErr) {
        console.warn("pools error:", pErr);
        setBookedRides([]);
        return;
      }

      // 3) rides for those pools
      const rideIds = [
        ...new Set((pools || []).map((p) => p.ride_id).filter(Boolean)),
      ];
      if (rideIds.length === 0) {
        setBookedRides([]);
        return;
      }
      const { data: rides, error: rErr } = await supabase
        .from("rides")
        .select(
          `
    *,
    profiles(*),
    ride_pools(booking_code)
  `
        )
        .in("id", rideIds);

      if (rErr) {
        console.warn("rides error:", rErr);
        setBookedRides([]);
        return;
      }

      // 4) combine
      const byPoolId = Object.fromEntries((pools || []).map((p) => [p.id, p]));
      const byRideId = Object.fromEntries((rides || []).map((r) => [r.id, r]));

      // 🔑 Batch fetch booking statuses
      let statuses = {};
      try {
        const res = await fetch(
          `${
            import.meta.env.VITE_STRIPE_BACKEND
          }/api/rides/booking-status/batch`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rideIds, userId: user.id }),
          }
        );
        const json = await res.json();
        if (res.ok) statuses = json;
      } catch (err) {
        console.warn("batch booking-status failed", err);
      }

      const formatted = contribs
        .map((c) => {
          const pool = byPoolId[c.ride_pool_id];
          const ride = byRideId[pool?.ride_id];
          if (!ride) return null;
          // ride.booking_code = ride.ride_pools?.booking_code || null;

          return {
            ride,
            pool,
            bookingDetails: {
              paid: c.status === "paid",
              share: (c.user_share_minor || 0) / 100,
              fee: (c.platform_fee_minor || 0) / 100,
              checkedIn: !!c.checked_in_at,
              status: statuses[ride.id] || null,
              isHost: c.is_host,
              lost_host: !!c.lost_host,
              booking_code: c.booking_code || null,
            },
          };
        })
        .filter(Boolean);

      setBookedRides(formatted);
    };

    fetchPublishedRides();
    fetchSavedRides();
    fetchBookedRides();
  }, [user]);

  // Today as YYYY-MM-DD
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Published: Active vs Past (unchanged)
  const activeRides = useMemo(
    () => publishedRides.filter((r) => r.date >= today),
    [publishedRides, today]
  );
  const pastRides = useMemo(
    () => publishedRides.filter((r) => r.date < today),
    [publishedRides, today]
  );

  // NEW: Booked: Active vs Past
  const bookedActive = useMemo(
    () =>
      bookedRides
        .filter(({ ride }) => ride.date >= today)
        .sort((a, b) => a.ride.date.localeCompare(b.ride.date)),
    [bookedRides, today]
  );
  const bookedPast = useMemo(
    () =>
      bookedRides
        .filter(({ ride }) => ride.date < today)
        .sort((a, b) => b.ride.date.localeCompare(a.ride.date)),
    [bookedRides, today]
  );

  const handleEdit = (rideId) => navigate(`/edit-ride/${rideId}`);

  const confirmDelete = (rideId) => {
    setRideToDelete(rideId);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!rideToDelete) return;
    setLoading(true);

    try {
      // get JWT
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      // call backend
      const res = await fetch(
        `${import.meta.env.VITE_STRIPE_BACKEND.replace(
          /\/$/,
          ""
        )}/api/rides/${rideToDelete}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setPublishedRides((prev) => prev.filter((r) => r.id !== rideToDelete));
        toast.success("Ride deleted successfully.");
      } else {
        toast.error(json.error || "Failed to delete ride.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete ride.");
    }

    setConfirmOpen(false);
    setRideToDelete(null);
    setLoading(false);
  };

  const handleUnsave = async (rideId) => {
    const { error } = await supabase
      .from("saved_rides")
      .delete()
      .eq("user_id", user.id)
      .eq("ride_id", rideId);

    if (!error) {
      setSavedRides((prev) => prev.filter((r) => r.id !== rideId));
      toast.info("Ride removed from saved rides.");
    }
  };

  // Confirm ride button logic
  const canShowConfirmButton = (ride, pool, bookingDetails, user) => {
    if (!ride || !user) return false;

    const now = new Date();
    const rideDateTime = new Date(`${ride.date}T${ride.time || "00:00"}`);

    // 1️⃣ Ride already departed
    if (rideDateTime <= now) return false;

    // 2️⃣ Host confirmation window expired
    const confirmBy = pool?.confirm_by ? new Date(pool.confirm_by) : null;
    if (confirmBy && confirmBy <= now) return false;

    // 3️⃣ Host already confirmed or ride completed
    const status = bookingDetails?.status;
    if (["confirmed", "completed", "paid"].includes(status)) return false;

    // 4️⃣ Only show to the current host
    if (!bookingDetails?.isHost && ride.user_id !== user.id) return false;

    // ✅ All good
    return true;
  };
  //Counter
  // tick every second to update countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // helper to format time left (mm:ss)
  const getCountdown = (confirmBy) => {
    if (!confirmBy) return null;
    const diffMs = new Date(confirmBy) - new Date();
    if (diffMs <= 0) return "expired";

    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="public-profile">
      <h2>My Rides</h2>

      <div className="tab-buttons">
        <button
          onClick={() => changeTab("published")}
          className={activeTab === "published" ? "active" : ""}
        >
          Published Rides
        </button>
        <button
          onClick={() => changeTab("saved")}
          className={activeTab === "saved" ? "active" : ""}
        >
          Saved Rides
        </button>
        <button
          onClick={() => changeTab("booked")}
          className={activeTab === "booked" ? "active" : ""}
        >
          Booked Rides
        </button>
      </div>

      {activeTab === "published" && (
        <div className="rides-section">
          <h3>Active Rides</h3>
          {activeRides.length > 0 ? (
            <ul className="ride-list">
              {activeRides.map((ride) => (
                <li key={ride.id} className="ride-list-item">
                  <RideCard
                    ride={ride}
                    user={user}
                    bookingDetails={ride.bookingDetails || null}
                    canEdit={true}
                    onEdit={handleEdit}
                    onDelete={() => confirmDelete(ride.id)}
                  />

                  {/* Booking status badge (only if ride.bookingDetails exists) */}
                  {ride.bookingDetails?.status === "pending" && (
                    <p
                      style={{
                        marginTop: 6,
                        color: "#b76e00",
                        fontWeight: 500,
                      }}
                    >
                      🟠 Pending — waiting on host to confirm
                    </p>
                  )}
                  {ride.bookingDetails?.status === "confirmed" && (
                    <p
                      style={{ marginTop: 6, color: "green", fontWeight: 500 }}
                    >
                      🟢 Confirmed — ride is scheduled
                    </p>
                  )}
                  {ride.bookingDetails?.status === "canceled" && (
                    <p style={{ marginTop: 6, color: "red", fontWeight: 500 }}>
                      🔴 Canceled — your payment has been refunded
                    </p>
                  )}

                  {/* 🔹 Only show Confirm button if host’s window not expired */}
                  {(ride.user_id === user.id || bookingDetails?.isHost) &&
                    Array.isArray(ride.ride_pools) &&
                    ride.ride_pools[0]?.confirm_by &&
                    getCountdown(ride.ride_pools[0].confirm_by) !==
                      "expired" && (
                      <button
                        className="btn"
                        onClick={async () => {
                          try {
                            const {
                              data: { session },
                            } = await supabase.auth.getSession();
                            const token = session?.access_token;

                            if (!token) {
                              toast.error(
                                "Not authenticated. Please log in again."
                              );
                              return;
                            }

                            const res = await fetch(
                              `${
                                import.meta.env.VITE_STRIPE_BACKEND
                              }/api/payments/create-host-session`,
                              {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  rideId: ride.id,
                                  userId: user.id,
                                  email: user.email,
                                }),
                              }
                            );

                            const data = await res.json();
                            if (data.url) {
                              window.location.href = data.url;
                            } else {
                              toast.error(
                                data.error ||
                                  "Failed to start host confirmation"
                              );
                            }
                          } catch (e) {
                            toast.error("Request failed");
                          }
                        }}
                      >
                        Confirm Ride
                      </button>
                    )}

                  {/* 🔸 Show live countdown until host confirmation expires */}
                  {ride.ride_pools?.length > 0 &&
                    ride.ride_pools[0]?.confirm_by && (
                      <p
                        style={{
                          marginTop: 6,
                          fontSize: "0.9em",
                          color:
                            getCountdown(ride.ride_pools[0].confirm_by) ===
                            "expired"
                              ? "red"
                              : "#555",
                          fontWeight:
                            getCountdown(ride.ride_pools[0].confirm_by) ===
                            "expired"
                              ? "600"
                              : "400",
                        }}
                      >
                        ⏳ Confirm by{" "}
                        {getCountdown(ride.ride_pools[0].confirm_by) ===
                        "expired"
                          ? "Host window expired — next passenger may become host"
                          : `Confirm within ${getCountdown(
                              ride.ride_pools[0].confirm_by
                            )}`}
                      </p>
                    )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No active rides.</p>
          )}

          <h3>Past Rides</h3>
          {pastRides.length > 0 ? (
            <ul className="ride-list">
              {pastRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  canEdit={false}
                />
              ))}
            </ul>
          ) : (
            <p>No past rides.</p>
          )}
        </div>
      )}

      {activeTab === "saved" && (
        <div className="rides-section">
          {savedRides.length > 0 ? (
            <ul className="ride-list">
              {savedRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  canSave={true}
                  isSaved={true}
                  showBookNow={true}
                  onStartChat={() => navigate(`/chat/${ride.profiles.id}`)}
                  onSaveToggle={handleUnsave}
                />
              ))}
            </ul>
          ) : (
            <p>No saved rides.</p>
          )}
        </div>
      )}

      {activeTab === "booked" && (
        <div className="rides-section">
          <h3>Active Booked Rides</h3>
          {bookedActive.length > 0 ? (
            <ul className="ride-list">
              {bookedActive.map(({ ride, bookingDetails, pool }) => {
                // simple countdown until ride time
                const rideDateTime = new Date(
                  `${ride.date}T${ride.time || "00:00"}`
                );
                const msLeft = rideDateTime.getTime() - Date.now();
                const countdown =
                  msLeft > 0
                    ? `${Math.floor(msLeft / (1000 * 60 * 60))}h ${Math.floor(
                        (msLeft / (1000 * 60)) % 60
                      )}m`
                    : null;

                // progress tracker stage
                let stage = 1;
                if (bookingDetails?.status === "pending") stage = 2;
                if (bookingDetails?.status === "confirmed") stage = 3;

                return (
                  <li key={ride.id} className="ride-list-item">
                    <RideCard
                      ride={ride}
                      user={user}
                      bookingDetails={bookingDetails} //CHECK HERE
                      onStartChat={() => navigate(`/chat/${ride.profiles.id}`)}
                    />
                    {/* Host / Promotion messages */}
                    {bookingDetails?.isHost && !bookingDetails?.lost_host && (
                      <p
                        style={{
                          marginTop: 8,
                          color: "green",
                          fontWeight: 500,
                        }}
                      >
                        👑 You are now the host of this ride.
                      </p>
                    )}

                    {bookingDetails?.lost_host && !bookingDetails?.isHost && (
                      <p
                        style={{
                          marginTop: 8,
                          color: "#b76e00",
                          fontWeight: 500,
                        }}
                      >
                        ⚠️ Your host window expired. Another passenger may now
                        host this ride.
                      </p>
                    )}

                    {/* Booking status note */}
                    {bookingDetails?.status === "pending" && (
                      <p className="muted" style={{ marginTop: 8 }}>
                        Pending — waiting for the host to confirm the ride.
                      </p>
                    )}

                    {bookingDetails?.status === "confirmed" && (
                      <p className="success" style={{ marginTop: 8 }}>
                        Confirmed! Ride is scheduled for {ride.date} at{" "}
                        {ride.time}.
                        {countdown && (
                          <span style={{ marginLeft: 6, fontStyle: "italic" }}>
                            (Starts in {countdown})
                          </span>
                        )}
                      </p>
                    )}

                    {bookingDetails?.status === "canceled" && (
                      <p
                        className="muted"
                        style={{ marginTop: 8, color: "red" }}
                      >
                        ❌ This ride has been canceled. You have been refunded.
                      </p>
                    )}

                    {/* Booking cancelation */}
                    {bookingDetails && bookingDetails.status === "refunded" && (
                      <p
                        className="muted"
                        style={{ marginTop: 8, color: "red" }}
                      >
                        ❌ This ride has been canceled. You have been refunded.
                      </p>
                    )}
                    {bookingDetails && bookingDetails.status === "failed" && (
                      <p
                        className="muted"
                        style={{ marginTop: 8, color: "red" }}
                      >
                        ❌ This ride failed — your payment was released back.
                      </p>
                    )}

                    {/* Progress tracker */}
                    {/* <div
                      className="progress-tracker"
                      style={{ margin: "12px 0" }}
                    >
                      <span className={stage >= 1 ? "done" : ""}>
                        💳 Payment
                      </span>
                      <span style={{ margin: "0 8px" }}>→</span>
                      <span className={stage >= 2 ? "done" : ""}>
                        ⏳ Waiting Host
                      </span>
                      <span style={{ margin: "0 8px" }}>→</span>
                      <span className={stage >= 3 ? "done" : ""}>
                        ✅ Confirmed
                      </span>
                      <span
                        className={
                          bookingDetails?.status === "refunded" ? "done" : ""
                        }
                      >
                        ❌ Canceled
                      </span>
                    </div> */}

                    {/* Active rides: Booking Flow widgets */}
                    <div className="booking-flow-widgets">
                      <IssueCodePanel rideId={ride.id} user={user} />
                      <CheckInPanel rideId={ride.id} user={user} />
                      <ConfirmBookedButton rideId={ride.id} user={user} />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No active booked rides.</p>
          )}

          <h3>Past Booked Rides</h3>
          {bookedPast.length > 0 ? (
            <ul className="ride-list">
              {bookedPast.map(({ ride, bookingDetails, pool }) => (
                <li key={ride.id} className="ride-list-item">
                  <RideCard
                    ride={ride}
                    user={user}
                    bookingDetails={bookingDetails} //CHECK HERE
                    onStartChat={() => navigate(`/chat/${ride.profiles.id}`)}
                  />
                  {/* Booking status badge */}
                  {bookingDetails?.status === "pending" && (
                    <p
                      style={{
                        marginTop: 6,
                        color: "#b76e00",
                        fontWeight: 500,
                      }}
                    >
                      🟠 Pending — waiting on host to confirm
                    </p>
                  )}

                  {bookingDetails?.status === "confirmed" && (
                    <p
                      style={{ marginTop: 6, color: "green", fontWeight: 500 }}
                    >
                      Completed — this ride has ended
                    </p>
                  )}

                  {bookingDetails?.status === "canceled" && (
                    <p style={{ marginTop: 6, color: "red", fontWeight: 500 }}>
                      🔴 Canceled — your payment has been refunded
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>No past booked rides.</p>
          )}
        </div>
      )}

      <ToastContainer position="top-center" autoClose={2500} />
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        message="Are you sure you want to delete this ride?"
      />
    </div>
  );
}
