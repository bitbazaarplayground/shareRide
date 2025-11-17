import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Avatar from "../Components/Avatar";
import RideCard from "../Components/RideCard";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/PublicProfile.css";

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [rides, setRides] = useState([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      if (error) console.error("Error fetching profile:", error);
      else setProfileData(data);
    };

    const fetchRides = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("user_id", id)
        .order("date", { ascending: true });
      if (error) console.error("Error fetching rides:", error);
      else setRides(data);
    };

    fetchProfile();
    fetchRides();
  }, [id]);

  const handleStartChat = async (ridePosterId, rideId) => {
    const [userA, userB] =
      user.id < ridePosterId
        ? [user.id, ridePosterId]
        : [ridePosterId, user.id];

    const { data: existingChat } = await supabase
      .from("chats")
      .select("id")
      .eq("user1", userA)
      .eq("user2", userB)
      .eq("ride_id", rideId)
      .maybeSingle();

    let chatId;

    if (existingChat) {
      chatId = existingChat.id;
    } else {
      const { data: newChat, error: createError } = await supabase
        .from("chats")
        .insert([{ user1: userA, user2: userB, ride_id: rideId }])
        .select()
        .single();

      if (createError) {
        console.error("Error creating chat:", createError);
        return;
      }

      chatId = newChat.id;
    }

    navigate(`/chat/${chatId}`);
  };

  if (!profileData) return <p>Loading...</p>;

  const parsedInterests = profileData.interests
    ? Array.isArray(profileData.interests)
      ? profileData.interests
      : profileData.interests.split(",").map((i) => i.trim())
    : [];

  const today = new Date().toISOString().split("T")[0];
  const activeRides = rides.filter((r) => r.date >= today);
  const pastRides = rides.filter((r) => r.date < today);

  return (
    <div className="public-profile">
      <h2>{profileData.nickname}'s Profile</h2>

      <Avatar
        src={profileData.avatar_url}
        name={profileData.nickname}
        alt={`${profileData.nickname}'s avatar`}
        className="small-avatar"
      />
      <p>
        <strong>Name:</strong> {profileData.name}
      </p>
      <p>
        <strong>Age:</strong> {profileData.age}
      </p>
      <p>
        <strong>Interests:</strong> {parsedInterests.join(", ")}
      </p>
      <p>
        <strong>About:</strong> {profileData.bio}
      </p>

      <div className="rides-section">
        <h3>Active Rides</h3>
        {activeRides.length > 0 ? (
          <ul className="ride-list">
            {activeRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={{ ...ride, profiles: profileData }}
                user={user}
                showAvatar={true}
                showBookNow={user && user.id !== profileData.id}
                onStartChat={handleStartChat}
              />
            ))}
          </ul>
        ) : (
          <p>No active rides.</p>
        )}

        <h3>Past Rides</h3>
        {pastRides.length > 0 ? (
          <ul className="ride-list">
            {pastRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={{ ...ride, profiles: profileData }}
                user={user}
                showAvatar={false}
              />
            ))}
          </ul>
        ) : (
          <p>No past rides.</p>
        )}
      </div>
    </div>
  );
}
