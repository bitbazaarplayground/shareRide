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

const TABS = ["published", "saved", "booked"];

export default function MyRidesRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activeTab, changeTab } = useTabQueryParam(TABS, "published");

  const [publishedRides, setPublishedRides] = useState([]);
  const [savedRides, setSavedRides] = useState([]);
  const [bookedRides, setBookedRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rideToDelete, setRideToDelete] = useState(null);

  useEffect(() => {
    if (!user) return;

    // FETCH PUBLISHED RIDES
    const fetchPublishedRides = async () => {
      const { data } = await supabase
        .from("rides")
        .select(
          `
  *,
  profiles(*),
  ride_requests!left(status, seats)
`
        )

        .eq("user_id", user.id)
        .order("date", { ascending: true });

      setPublishedRides(data || []);
    };

    // FETCH SAVED RIDES
    const fetchSavedRides = async () => {
      const { data } = await supabase
        .from("saved_rides")
        .select("rides(*, profiles(*))")
        .eq("user_id", user.id);

      setSavedRides((data || []).map((entry) => entry.rides));
    };

    // FETCH BOOKED RIDES (deposit-based)
    const fetchBookedRides = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const token = session?.access_token;
        if (!token) return;

        const BACKEND = import.meta.env.VITE_STRIPE_BACKEND.replace(/\/$/, "");
        const res = await fetch(`${BACKEND}/api/rides-new/my/deposits`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const json = await res.json();
        if (res.ok && json.ok) {
          setBookedRides(json.deposits || []);
        }
      } catch (err) {
        console.error("fetchBookedRides:", err);
      }
    };

    fetchPublishedRides();
    fetchSavedRides();
    fetchBookedRides();
  }, [user]);

  // DATE FILTERS
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const activeRides = useMemo(
    () => publishedRides.filter((r) => r.date >= today),
    [publishedRides, today]
  );
  const pastRides = useMemo(
    () => publishedRides.filter((r) => r.date < today),
    [publishedRides, today]
  );

  // DELETE FLOW
  const handleEdit = (rideId) => navigate(`/edit-ride/${rideId}`);
  const confirmDelete = (rideId) => {
    setRideToDelete(rideId);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!rideToDelete) return;
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_STRIPE_BACKEND.replace(
          /\/$/,
          ""
        )}/api/rides/${rideToDelete}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );

      const json = await res.json();
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

  // UNSAVE FLOW
  const handleUnsave = async (rideId) => {
    await supabase
      .from("saved_rides")
      .delete()
      .eq("user_id", user.id)
      .eq("ride_id", rideId);
    setSavedRides((prev) => prev.filter((r) => r.id !== rideId));
    toast.info("Ride removed from saved rides.");
  };

  // HANDLE PAYMENT
  const handlePayNow = async (deposit) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const BACKEND = import.meta.env.VITE_STRIPE_BACKEND.replace(/\/$/, "");

      const res = await fetch(`${BACKEND}/api/payments-new/pay-deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ depositId: deposit.id }),
      });

      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        toast.error(json.error || "Payment could not be started.");
      }
    } catch (err) {
      toast.error("Payment request failed.");
    }
  };

  return (
    <div className="public-profile">
      <h2>My Rides</h2>

      {/* TABS */}
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

      {/* =======================
           PUBLISHED RIDES (HOST)
      ======================= */}
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
                    canEdit={true}
                    onEdit={handleEdit}
                    onDelete={() => confirmDelete(ride.id)}
                    showManageRideButton={true}
                  />

                  <button
                    className="btn"
                    onClick={() => navigate(`/host/ride/${ride.id}`)}
                    style={{ marginTop: "0.5rem" }}
                  >
                    Manage ride
                  </button>
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
                  showHostTools={false}
                />
              ))}
            </ul>
          ) : (
            <p>No past rides.</p>
          )}
        </div>
      )}

      {/* =======================
           SAVED RIDES
      ======================= */}
      {activeTab === "saved" && (
        <div className="rides-section">
          {savedRides.length > 0 ? (
            <ul className="ride-list">
              {savedRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  isSaved={true}
                  onSaveToggle={handleUnsave}
                  showRequestButton={true}
                />
              ))}
            </ul>
          ) : (
            <p>No saved rides.</p>
          )}
        </div>
      )}

      {/* =======================
           BOOKED RIDES (DEPOSITS)
      ======================= */}
      {activeTab === "booked" && (
        <div className="rides-section">
          <h3>Your Booked Rides</h3>

          {bookedRides.length > 0 ? (
            <ul className="ride-list">
              {bookedRides.map((deposit) => {
                const ride = deposit.rides;
                const isPendingPayment = deposit.status === "pending";
                const isPaid = deposit.status === "paid";

                return (
                  <li key={deposit.id} className="ride-list-item">
                    <RideCard ride={ride} user={user} />

                    {isPendingPayment && (
                      <button
                        className="btn pay-btn"
                        onClick={() => handlePayNow(deposit)}
                        style={{ marginTop: "0.5rem" }}
                      >
                        Pay £
                        {(deposit.amount_minor + deposit.platform_fee_minor) /
                          100}
                      </button>
                    )}

                    {isPaid && (
                      <>
                        <p className="success" style={{ marginTop: "0.5rem" }}>
                          Payment Completed
                        </p>

                        {/* ⭐ Add the check-in code display here ⭐ */}
                        {deposit.checkin_code && (
                          <div
                            className="checkin-box"
                            style={{ marginTop: "0.5rem" }}
                          >
                            <p>
                              <strong>Your Check-In Code:</strong>{" "}
                              <span style={{ fontSize: "1.2rem" }}>
                                {deposit.checkin_code}
                              </span>
                            </p>

                            <button
                              className="btn small-btn"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  deposit.checkin_code
                                );
                                toast.success("Check-in code copied!");
                              }}
                              style={{
                                marginTop: "0.3rem",
                                padding: "0.3rem 0.8rem",
                                fontSize: "0.9rem",
                              }}
                            >
                              Copy Code
                            </button>

                            {deposit.checkin_code_expires_at && (
                              <p style={{ fontSize: "0.8rem", color: "#777" }}>
                                Expires:{" "}
                                {new Date(
                                  deposit.checkin_code_expires_at
                                ).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No booked rides yet.</p>
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
