import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function IndividualRide() {
  const { id } = useParams();
  const [ride, setRide] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRideWithUser() {
      // Step 1: Get the ride by ID
      const { data: rideData, error: rideError } = await supabase
        .from("rides")
        .select("*")
        .eq("id", id)
        .single();

      if (rideError) {
        console.error("Error fetching ride:", rideError);
        setLoading(false);
        return;
      }

      setRide(rideData);

      // Step 2: Fetch the user who posted the ride
      if (rideData.user_id) {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("name, email") // adjust fields as needed
          .eq("id", rideData.user_id)
          .single();

        if (userError) {
          console.error("Error fetching user:", userError);
        } else {
          setUser(userData);
        }
      }

      setLoading(false);
    }

    fetchRideWithUser();
  }, [id]);

  if (loading) return <p>Loading ride details...</p>;
  if (!ride) return <p>Ride not found.</p>;

  return (
    <div className="ride-details">
      <h2>Ride Details</h2>
      <p>
        <strong>From:</strong> {ride.from}
      </p>
      <p>
        <strong>To:</strong> {ride.to}
      </p>
      <p>
        <strong>Date:</strong> {ride.date}
      </p>
      <p>
        <strong>Seats Available:</strong> {ride.seats}
      </p>
      <p>
        <strong>Notes:</strong> {ride.notes || "No notes"}
      </p>

      <hr />

      <h3>Posted By</h3>
      {user ? (
        <>
          <p>
            <strong>Name:</strong> {user.name}
          </p>
          <p>
            <strong>Contact:</strong> {user.email}
          </p>
        </>
      ) : (
        <p>User info not available.</p>
      )}
    </div>
  );
}
