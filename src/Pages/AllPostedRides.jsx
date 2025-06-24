import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/AllPostedRides.css";

export default function AllPostedRides() {
  const { user } = useAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fetchRides = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rides")
      .select("*, profiles(id, nickname, avatar_url)")
      .order("date", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
      setErrorMsg("Failed to load rides.");
      setRides([]);
    } else {
      setRides(data);
      setErrorMsg("");
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRides();
  }, []);

  const handleDelete = async (rideId) => {
    const confirmDelete = window.confirm("Are you sure?");
    if (!confirmDelete) return;

    const { error } = await supabase.from("rides").delete().eq("id", rideId);

    if (error) {
      console.error("Delete error:", error);
      setErrorMsg("Failed to delete ride.");
      setSuccessMessage("");
    } else {
      setSuccessMessage("Ride deleted successfully!");
      // Remove from UI immediately:
      setRides((prev) => prev.filter((r) => r.id !== rideId));
      setErrorMsg("");
    }
  };

  return (
    <div className="all-rides-container">
      <h2>All Published Rides</h2>

      {successMessage && <p className="success">{successMessage}</p>}
      {errorMsg && <p className="error">{errorMsg}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : rides.length === 0 ? (
        <p>No rides have been published yet.</p>
      ) : (
        <ul className="ride-list">
          {rides.map((ride) => (
            <li key={ride.id} className="ride-card">
              <Link to={`/individual-ride/${ride.id}`} className="ride-link">
                <strong>From:</strong> {ride.from} → <strong>To:</strong>{" "}
                {ride.to}
              </Link>

              <div className="ride-details">
                <p>
                  <strong>Date:</strong> {ride.date}
                </p>
                <p>
                  <strong>Seats:</strong> {ride.seats}
                </p>
              </div>

              {ride.profiles && (
                <div className="poster-info">
                  <img
                    src={ride.profiles.avatar_url || "/default-avatar.png"}
                    alt={`${ride.profiles.nickname}'s avatar`}
                    className="poster-avatar"
                  />
                  <Link
                    to={`/profile/${ride.profiles.id}`}
                    className="poster-nickname"
                  >
                    {ride.profiles.nickname}
                  </Link>
                </div>
              )}
              {ride.notes && (
                <p className="ride-notes">
                  <em>{ride.notes}</em>
                </p>
              )}
              <div className="ride-actions">
                <Link
                  to={`/chat/${ride.profiles.id}`}
                  className="send-message-btn"
                >
                  Message
                </Link>
                {user?.id === ride.profiles.id && (
                  <button
                    className="delete-ride-btn"
                    onClick={() => handleDelete(ride.id)}
                  >
                    Delete Ride
                  </button>
                )}
              </div>

              <hr />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
