import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";

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
        .select("*")
        .order("date", { ascending: true }); // optional: sort by date

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
              {ride.notes && <em>{ride.notes}</em>}
              <hr />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
