import {
  collection,
  getDocs,
  getFirestore,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import app from "../firebase";
import "./StylesPages/AllPostedRides.css";

export default function AllPostedRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const location = useLocation();
  const successMessage = location.state?.message;

  useEffect(() => {
    const db = getFirestore(app);

    async function fetchRides() {
      try {
        const q = query(collection(db, "rides"), orderBy("date", "asc"));
        const querySnapshot = await getDocs(q);

        const fetchedRides = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setRides(fetchedRides);
      } catch (error) {
        setErrorMsg("Failed to fetch rides.");
        console.error("Error fetching rides:", error);
      }

      setLoading(false);
    }

    fetchRides();
  }, []);

  return (
    <div className="all-rides-container">
      <h2>All Published Rides</h2>
      {successMessage && <p className="success">{successMessage}</p>}
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
              {ride.profile && (
                <div
                  className="poster-info"
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <img
                    src={ride.profile.avatar_url || "/default-avatar.png"}
                    alt={`${ride.profile.nickname}'s avatar`}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                    }}
                  />
                  <Link to={`/profile/${ride.profile.id}`}>
                    <strong>{ride.profile.nickname}</strong>
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
