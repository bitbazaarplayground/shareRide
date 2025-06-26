import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Avatar from "../Components/Avatar";
import { useAuth } from "../Contexts/AuthContext";
import SendMessageForm from "../Messages/SendMessageForm";
import { supabase } from "../supabaseClient";
import "./StylesPages/PublicProfile.css";

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
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

  if (!profileData) return <p>Loading...</p>;

  const parsedInterests = profileData.interests
    ? Array.isArray(profileData.interests)
      ? profileData.interests
      : profileData.interests.split(",").map((i) => i.trim())
    : [];

  const today = new Date().toISOString().split("T")[0];
  const activeRides = rides.filter((r) => r.date >= today);
  const pastRides = rides.filter((r) => r.date < today);

  const RideCard = ({ ride }) => (
    <div className="ride-card">
      <p>
        <strong>From:</strong> {ride.from} → <strong>To:</strong> {ride.to}
      </p>
      <p>
        <strong>Date:</strong> {ride.date}
      </p>
      <p>
        <strong>Seats:</strong> {ride.seats}
      </p>
      <div className="ride-author">
        <Avatar
          src={profileData.avatar_url}
          name={profileData.name}
          alt={`${profileData.name}'s avatar`}
          className="small-avatar"
        />
        <span>{profileData.nickname}</span>
      </div>
      {user && user.id !== id && <SendMessageForm recipientId={id} />}
    </div>
  );

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

      {user && user.id !== id && (
        <div className="message-section">
          <h3>Send a Message</h3>
          <SendMessageForm recipientId={id} />
        </div>
      )}

      <div className="rides-section">
        <h3>Active Rides</h3>
        {activeRides.length > 0 ? (
          activeRides.map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <p>No active rides.</p>
        )}

        <h3>Past Rides</h3>
        {pastRides.length > 0 ? (
          pastRides.map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <p>No past rides.</p>
        )}
      </div>
    </div>
  );
}
