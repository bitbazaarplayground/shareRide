import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmModal from "../Components/ConfirmModal";
import RideCard from "../Components/RideCard";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/MyRides.css";

export default function MyRidesRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [publishedRides, setPublishedRides] = useState([]);
  const [savedRides, setSavedRides] = useState([]);
  const [activeTab, setActiveTab] = useState("published");
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
        .select("rides(*)")
        .eq("user_id", user.id);

      if (!error) setSavedRides(data.map((entry) => entry.rides));
    };

    fetchPublishedRides();
    fetchSavedRides();
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
          onClick={() => setActiveTab("published")}
          className={activeTab === "published" ? "active" : ""}
        >
          Published Rides
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={activeTab === "saved" ? "active" : ""}
        >
          Saved Rides
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
                  onSaveToggle={handleUnsave}
                />
              ))}
            </ul>
          ) : (
            <p>No saved rides.</p>
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
