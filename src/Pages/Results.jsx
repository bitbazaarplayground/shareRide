import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RideCard from "../Components/RideCard";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/AllPostedRides.css";

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const rides = location.state?.rides || [];
  const successMessage = location.state?.message;

  const [savedRideIds, setSavedRideIds] = useState([]);

  useEffect(() => {
    if (!user) return;
    const fetchSaved = async () => {
      const { data, error } = await supabase
        .from("saved_rides")
        .select("ride_id")
        .eq("user_id", user.id);

      if (!error) {
        setSavedRideIds(data.map((entry) => entry.ride_id));
      }
    };
    fetchSaved();
  }, [user]);

  const toggleSaveRide = async (rideId) => {
    if (!user) return alert("Please log in to save rides.");

    if (savedRideIds.includes(rideId)) {
      await supabase
        .from("saved_rides")
        .delete()
        .eq("user_id", user.id)
        .eq("ride_id", rideId);
      setSavedRideIds((prev) => prev.filter((id) => id !== rideId));
    } else {
      await supabase
        .from("saved_rides")
        .insert([{ user_id: user.id, ride_id: rideId }]);
      setSavedRideIds((prev) => [...prev, rideId]);
    }
  };

  const handleDelete = async (rideId) => {
    if (!window.confirm("Are you sure you want to delete this ride?")) return;

    await supabase.from("rides").delete().eq("id", rideId);
    alert("Ride deleted. Refresh to see changes.");
  };

  const handleStartChat = async (posterId, rideId) => {
    const [userA, userB] =
      user.id < posterId ? [user.id, posterId] : [posterId, user.id];

    const { data: existing } = await supabase
      .from("chats")
      .select("id")
      .eq("user1", userA)
      .eq("user2", userB)
      .eq("ride_id", rideId)
      .maybeSingle();

    if (existing) return navigate(`/chat/${existing.id}`);

    const { data: newChat } = await supabase
      .from("chats")
      .insert([{ user1: userA, user2: userB, ride_id: rideId }])
      .select()
      .single();

    navigate(`/chat/${newChat.id}`);
  };

  return (
    <div className="all-rides-container">
      {successMessage && <p className="success">{successMessage}</p>}
      <h2>Matching Rides</h2>
      {rides.length === 0 ? (
        <p>No rides found.</p>
      ) : (
        <ul className="ride-list">
          {rides.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              user={user}
              isSaved={savedRideIds.includes(ride.id)}
              canSave={true}
              canEdit={user?.id === ride.profiles?.id}
              showBookNow={user && user.id !== ride.profiles?.id}
              onSaveToggle={toggleSaveRide}
              onDelete={handleDelete}
              onEdit={(id) => navigate(`/edit-ride/${id}`)}
              onStartChat={handleStartChat}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
