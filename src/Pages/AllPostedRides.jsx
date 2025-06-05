import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./StylesPages/AllPostedRides.css";

export default function AllPostedRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const location = useLocation();
  const successMessage = location.state?.message;
  {
    successMessage && <p className="success">{successMessage}</p>;
  }

  useEffect(() => {
    async function fetchRides() {
      const { data, error } = await supabase
        .from("rides")
        .select("*, profiles(id, nickname, avatar_url)")
        .order("date", { ascending: true });

      if (error) {
        setErrorMsg("Failed to fetch rides.");
        console.error("Error fetching rides:", error);
      } else {
        setRides(data);
      }

      setLoading(false);
    }

    fetchRides();
  }, []);

  return (
    <div className="all-rides-container">
      <h2>All Published Rides</h2>
      {loading ? (
        <p>Loading rides...</p>
      ) : errorMsg ? (
        <p>{errorMsg}</p>
      ) : rides.length === 0 ? (
        <p>No rides have been published yet.</p>
      ) : (
        <ul>
          {rides.map((ride) => (
            <li key={ride.id}>
              <Link to={`/individual-ride/${ride.id}`}>
                <strong>From:</strong> {ride.from} → <strong>To:</strong>{" "}
                {ride.to}
              </Link>
              <br />
              <strong>Date:</strong> {ride.date} <br />
              <strong>Seats:</strong> {ride.seats} <br />
              {/* User Info */}
              {ride.profiles && (
                <div
                  className="poster-info"
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <img
                    src={ride.profiles.avatar_url || "/default-avatar.png"}
                    alt={`${ride.profiles.nickname}'s avatar`}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                    }}
                  />
                  <Link to={`/profile/${ride.profiles.id}`}>
                    <strong>{ride.profiles.nickname}</strong>
                  </Link>
                </div>
              )}
              {ride.notes && (
                <p>
                  <em>{ride.notes}</em>
                </p>
              )}
              <hr />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
