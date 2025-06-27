import React from "react";
import { useLocation } from "react-router-dom";
import RideCard from "../Components/RideCard"; // adjust the path if needed
import "./StylesPages/AllPostedRides.css"; // reuse existing styles

export default function Results() {
  const location = useLocation();
  const rides = location.state?.rides || [];
  const successMessage = location.state?.message;

  return (
    <div className="all-rides-container">
      {successMessage && <p className="success">{successMessage}</p>}
      <h2>Matching Rides</h2>
      {rides.length === 0 ? (
        <p>No rides found.</p>
      ) : (
        <ul className="ride-list">
          {rides.map((ride) => (
            <RideCard key={ride.id} ride={ride} />
          ))}
        </ul>
      )}
    </div>
  );
}
