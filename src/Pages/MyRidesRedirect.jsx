import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/MyRides.css";

export default function MyRides() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchRides = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (error) console.error("Error fetching rides:", error);
      else setRides(data);
    };

    fetchRides();
  }, [user]);

  const today = new Date().toISOString().split("T")[0];
  const activeRides = rides.filter((r) => r.date >= today);
  const pastRides = rides.filter((r) => r.date < today);

  const handleEdit = (rideId) => {
    navigate(`/edit-ride/${rideId}`);
  };

  const handleDelete = async (rideId) => {
    const confirm = window.confirm(
      "Are you sure you want to delete this ride?"
    );
    if (!confirm) return;

    setLoading(true);
    const { error } = await supabase.from("rides").delete().eq("id", rideId);
    if (error) {
      console.error("Error deleting ride:", error);
      alert("Failed to delete ride.");
    } else {
      setRides((prev) => prev.filter((r) => r.id !== rideId));
    }
    setLoading(false);
  };

  const RideCard = ({ ride }) => (
    <div className="ride-card">
      <p>
        <strong>From:</strong> {ride.from} → <strong>To:</strong> {ride.to}
      </p>
      <p>
        <strong>Date:</strong> {ride.date}
      </p>
      <p>
        <strong>Seats:</strong> {ride.seats}
      </p>
      <div className="ride-actions">
        <button onClick={() => handleEdit(ride.id)} className="btn edit-btn">
          Edit
        </button>
        <button
          onClick={() => handleDelete(ride.id)}
          className="btn delete-btn"
          disabled={loading}
        >
          {loading ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="public-profile">
      <h2>My Rides</h2>

      <div className="rides-section">
        <h3>Active Rides</h3>
        {activeRides.length > 0 ? (
          activeRides.map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <p>No active rides.</p>
        )}

        <h3>Past Rides</h3>
        {pastRides.length > 0 ? (
          pastRides.map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <p>No past rides.</p>
        )}
      </div>
    </div>
  );
}
