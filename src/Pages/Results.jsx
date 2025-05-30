import React from "react";
import { useLocation } from "react-router-dom";

export default function Results() {
  const location = useLocation();
  const rides = location.state?.rides || [];

  return (
    <div className="results-container">
      <h2>Matching Rides</h2>
      {rides.length === 0 ? (
        <p>No rides found.</p>
      ) : (
        <ul>
          {rides.map((ride, index) => (
            <li key={index}>
              <strong>From:</strong> {ride.from} <br />
              <strong>To:</strong> {ride.to} <br />
              <strong>Date:</strong> {ride.date} <br />
              <strong>Seats:</strong> {ride.seats} <br />
              {ride.notes && <em>{ride.notes}</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
