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

  // keep ?tab= in sync
  const { activeTab, changeTab } = useTabQueryParam(TABS, "published");

  const [publishedRides, setPublishedRides] = useState([]);
  const [savedRides, setSavedRides] = useState([]);
  const [bookedRides, setBookedRides] = useState([]); // <-- will be replaced by ride_requests later
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rideToDelete, setRideToDelete] = useState(null);

  useEffect(() => {
    if (!user) return;

    // ------------------------------------------------------------
    // ✅ FETCH PUBLISHED RIDES (host-created)
    // ------------------------------------------------------------
    const fetchPublishedRides = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*, profiles(*)")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (!error) setPublishedRides(data || []);
    };

    // ------------------------------------------------------------
    // ✅ FETCH SAVED RIDES
    // ------------------------------------------------------------
    const fetchSavedRides = async () => {
      const { data, error } = await supabase
        .from("saved_rides")
        .select("rides(*, profiles(*))")
        .eq("user_id", user.id);

      if (!error) setSavedRides((data || []).map((entry) => entry.rides));
    };

    // ------------------------------------------------------------
    // ❌ REMOVE OLD BOOKED-RIDES BUILT FROM ride_pools + contributions
    // ------------------------------------------------------------
    // This entire block is replaced by the new ride_requests model later.
    const fetchBookedRides = async () => {
      setBookedRides([]); // placeholder until new model added
    };

    fetchPublishedRides();
    fetchSavedRides();
    fetchBookedRides();
  }, [user]);

  // ------------------------------------------------------------
  // TODAY
  // ------------------------------------------------------------
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  // ------------------------------------------------------------
  // FILTER PUBLISHED RIDES
  // ------------------------------------------------------------
  const activeRides = useMemo(
    () => publishedRides.filter((r) => r.date >= today),
    [publishedRides, today]
  );
  const pastRides = useMemo(
    () => publishedRides.filter((r) => r.date < today),
    [publishedRides, today]
  );

  // ------------------------------------------------------------
  // FILTER BOOKED RIDES (placeholder)
  // ------------------------------------------------------------
  const bookedActive = [];
  const bookedPast = [];

  // ------------------------------------------------------------
  // RIDE EDITING / DELETION
  // ------------------------------------------------------------
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
      if (!token) throw new Error("Not authenticated");

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

  return (
    <div className="public-profile">
      <h2>My Rides</h2>

      {/* Tabs */}
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

      {/* ============================
          PUBLISHED RIDES (HOST)
      ============================ */}
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
                  />

                  {/* “Manage ride” button */}
                  <button
                    className="btn"
                    style={{ marginTop: "0.5rem" }}
                    onClick={() => navigate(`/host/ride/${ride.id}`)}
                  >
                    Manage riders
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
                />
              ))}
            </ul>
          ) : (
            <p>No past rides.</p>
          )}
        </div>
      )}

      {/* ============================
          SAVED RIDES
      ============================ */}
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

      {/* ============================
          BOOKED RIDES (NEW MODEL)
          Using ride_requests + deposits later
      ============================ */}
      {activeTab === "booked" && (
        <div className="rides-section">
          <h3>Your Booked Rides</h3>

          {bookedActive.length > 0 ? (
            <ul className="ride-list">
              {bookedActive.map(({ ride }) => (
                <li key={ride.id} className="ride-list-item">
                  <RideCard
                    ride={ride}
                    user={user}
                    onStartChat={() => navigate(`/chat/${ride.profiles.id}`)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p>No upcoming booked rides.</p>
          )}

          <h3>Past Booked Rides</h3>
          {bookedPast.length > 0 ? (
            <ul className="ride-list">
              {bookedPast.map(({ ride }) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  onStartChat={() => navigate(`/chat/${ride.profiles.id}`)}
                />
              ))}
            </ul>
          ) : (
            <p>No previous booked rides.</p>
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
