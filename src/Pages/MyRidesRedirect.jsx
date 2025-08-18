import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmModal from "../Components/ConfirmModal";

import RideCard from "../Components/RideCard";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/MyRidesRedirect.css";

const TABS = ["published", "saved", "booked"];

export default function MyRidesRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ---- NEW: read & sync ?tab= from URL ----
  const [searchParams, setSearchParams] = useSearchParams();
  const normalizeTab = (t) => (TABS.includes(t) ? t : "published");

  const initialTab = useMemo(() => {
    const t = (searchParams.get("tab") || "").toLowerCase();
    return normalizeTab(t);
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState(initialTab);

  // keep state in sync with URL (back/forward, external links)
  useEffect(() => {
    const t = normalizeTab((searchParams.get("tab") || "").toLowerCase());
    setActiveTab((prev) => (prev !== t ? t : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const changeTab = (tab) => {
    const t = normalizeTab(tab);
    setActiveTab(t);
    const current = (searchParams.get("tab") || "").toLowerCase();
    if (current !== t) {
      // keep URL clean: omit ?tab when on the default tab
      if (t === "published") setSearchParams({});
      else setSearchParams({ tab: t });
    }
  };
  // -----------------------------------------

  const [publishedRides, setPublishedRides] = useState([]);
  const [savedRides, setSavedRides] = useState([]);
  const [bookedRides, setBookedRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rideToDelete, setRideToDelete] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchPublishedRides = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (!error) setPublishedRides(data);
    };

    const fetchSavedRides = async () => {
      const { data, error } = await supabase
        .from("saved_rides")
        .select("rides(*, profiles(*))")
        .eq("user_id", user.id);

      if (!error) setSavedRides(data.map((entry) => entry.rides));
    };

    const fetchBookedRides = async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          `
          id,
          seats_booked,
          backpacks,
          small_suitcases,
          large_suitcases,
          rides(*, profiles(*))
        `
        )
        .eq("user_id", user.id);

      if (!error) {
        const formatted = data.map((entry) => ({
          ride: entry.rides,
          bookingDetails: {
            seats: entry.seats_booked,
            backpacks: entry.backpacks,
            small: entry.small_suitcases,
            large: entry.large_suitcases,
          },
        }));
        setBookedRides(formatted);
      }
    };

    fetchPublishedRides();
    fetchSavedRides();
    fetchBookedRides();
  }, [user]);

  const today = new Date().toISOString().split("T")[0];
  const activeRides = publishedRides.filter((r) => r.date >= today);
  const pastRides = publishedRides.filter((r) => r.date < today);

  const handleEdit = (rideId) => {
    navigate(`/edit-ride/${rideId}`);
  };

  const confirmDelete = (rideId) => {
    setRideToDelete(rideId);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!rideToDelete) return;

    setLoading(true);
    const { error } = await supabase
      .from("rides")
      .delete()
      .eq("id", rideToDelete);

    if (!error) {
      setPublishedRides((prev) => prev.filter((r) => r.id !== rideToDelete));
      toast.success("Ride deleted successfully.");
    } else {
      toast.error("Failed to delete ride.");
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
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  canEdit={true}
                  onEdit={handleEdit}
                  onDelete={() => confirmDelete(ride.id)}
                />
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
                  canEdit={true}
                  onEdit={handleEdit}
                  onDelete={() => confirmDelete(ride.id)}
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
          {bookedRides.length > 0 ? (
            <ul className="ride-list">
              {bookedRides.map(({ ride, bookingDetails }) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  bookingDetails={bookingDetails}
                  onStartChat={() => navigate(`/chat/${ride.profiles.id}`)}
                />
              ))}
            </ul>
          ) : (
            <p>No booked rides.</p>
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
