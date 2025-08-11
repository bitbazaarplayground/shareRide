// src/Pages/Results.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RideCard from "../Components/RideCard";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/AllPostedRides.css";

// Simple haversine formula for distance in km
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Initial rides from search
  const rides = location.state?.rides || [];
  const successMessage = location.state?.message || "";

  // Optional coords + radius from SearchBar
  const fromCoords = location.state?.fromCoords || null;
  const toCoords = location.state?.toCoords || null;
  const radiusKm = location.state?.radiusKm || null;

  const [savedRideIds, setSavedRideIds] = useState([]);

  // Filter by radius client-side (if coords provided)
  const filteredRides = useMemo(() => {
    if (!radiusKm || !fromCoords || !toCoords) return rides;

    return rides.filter((ride) => {
      const withinFrom =
        ride.from_lat &&
        ride.from_lng &&
        haversineKm(
          fromCoords.lat,
          fromCoords.lng,
          ride.from_lat,
          ride.from_lng
        ) <= radiusKm;

      const withinTo =
        ride.to_lat &&
        ride.to_lng &&
        haversineKm(toCoords.lat, toCoords.lng, ride.to_lat, ride.to_lng) <=
          radiusKm;

      return withinFrom && withinTo;
    });
  }, [rides, radiusKm, fromCoords, toCoords]);

  // Fetch saved rides
  useEffect(() => {
    if (!user) return;
    const fetchSaved = async () => {
      const { data, error } = await supabase
        .from("saved_rides")
        .select("ride_id")
        .eq("user_id", user.id);
      if (!error && data) {
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
      {filteredRides.length === 0 ? (
        <p>No rides found.</p>
      ) : (
        <ul className="ride-list">
          {filteredRides.map((ride) => (
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
