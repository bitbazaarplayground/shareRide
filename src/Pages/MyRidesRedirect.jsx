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
  const handlePayNow = async (rideId) => {
    console.log("VITE_STRIPE_BACKEND =", import.meta.env.VITE_STRIPE_BACKEND);

    try {
      // 1️⃣ Get auth token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("Not authenticated.");
        return;
      }

      const token = session.access_token;

      // 2️⃣ Load this user's deposit for this ride
      const depRes = await fetch(
        `${
          import.meta.env.VITE_STRIPE_BACKEND
        }/api/payments-new/deposits/${rideId}/mine`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const depJson = await depRes.json();

      if (!depJson.ok) {
        toast.error(depJson.error || "Failed to load deposit.");
        return;
      }

      if (!depJson.deposit) {
        toast.error(
          "Deposit not created. Ask host to accept your request first."
        );
        return;
      }

      const depositId = depJson.deposit.id;

      // 3️⃣ Create Stripe checkout session
      const sessionRes = await fetch(
        `${
          import.meta.env.VITE_STRIPE_BACKEND
        }/api/payments-new/deposits/${depositId}/create-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: session.user.email,
          }),
        }
      );

      const sessionJson = await sessionRes.json();

      if (!sessionJson.ok || !sessionJson.url) {
        toast.error(sessionJson.error || "Failed to start payment.");
        return;
      }

      // 4️⃣ Redirect user to Stripe Checkout
      window.location.href = sessionJson.url;
    } catch (err) {
      console.error(err);
      toast.error("Payment failed.");
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

                // 🔍 Debug so we can SEE what we get
                console.log("Booked ride row:", {
                  id: deposit.id,
                  status: deposit.status,
                  checkin_code: deposit.checkin_code,
                  checkin_code_expires_at: deposit.checkin_code_expires_at,
                });

                return (
                  <li key={deposit.id} className="ride-list-item">
                    {/* Main ride info card */}
                    <RideCard ride={ride} user={user} />

                    {/* Pending payment -> show Pay button */}
                    {isPendingPayment && (
                      <button
                        className="btn pay-btn"
                        onClick={() => handlePayNow(deposit.ride_id)}
                        style={{ marginTop: "0.5rem" }}
                      >
                        Pay £
                        {(deposit.amount_minor + deposit.platform_fee_minor) /
                          100}
                      </button>
                    )}

                    {/* PAID state */}
                    {isPaid && (
                      <div className="payment-status-block">
                        <p className="success" style={{ marginTop: "0.5rem" }}>
                          Payment Completed
                        </p>

                        {deposit.checked_in_at ? (
                          <p className="checked-in-msg">✓ You are checked in</p>
                        ) : (
                          <p className="waiting-msg">Waiting for check-in…</p>
                        )}

                        {/* ⭐ Check-in code for passenger ⭐ */}
                        <div
                          className="checkin-box"
                          style={{
                            marginTop: "0.5rem",
                            padding: "0.75rem 1rem",
                            borderRadius: "8px",
                            background: "#f4f6ff",
                            border: "1px solid #d5ddff",
                          }}
                        >
                          {deposit.checkin_code ? (
                            <>
                              <p style={{ marginBottom: "0.25rem" }}>
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
                                <p
                                  style={{
                                    marginTop: "0.25rem",
                                    fontSize: "0.8rem",
                                    color: "#777",
                                  }}
                                >
                                  Expires:{" "}
                                  {new Date(
                                    deposit.checkin_code_expires_at
                                  ).toLocaleString()}
                                </p>
                              )}
                            </>
                          ) : (
                            <p style={{ fontSize: "0.9rem", color: "#555" }}>
                              Your payment is confirmed. Your unique check-in
                              code should appear here shortly. If it doesn’t
                              show after refreshing the page, please contact
                              support.
                            </p>
                          )}
                        </div>
                      </div>
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
