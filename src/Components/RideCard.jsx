import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./Styles/RideCard.css";

export default function RideCard({ ride }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStartChat = async () => {
    const [userA, userB] =
      user.id < ride.profiles.id
        ? [user.id, ride.profiles.id]
        : [ride.profiles.id, user.id];

    const { data: existingChat } = await supabase
      .from("chats")
      .select("id")
      .eq("user1", userA)
      .eq("user2", userB)
      .eq("ride_id", ride.id)
      .maybeSingle();

    let chatId;

    if (existingChat) {
      chatId = existingChat.id;
    } else {
      const { data: newChat, error } = await supabase
        .from("chats")
        .insert([{ user1: userA, user2: userB, ride_id: ride.id }])
        .select()
        .single();

      if (error) {
        console.error("Error creating chat:", error);
        return;
      }

      chatId = newChat.id;
    }

    navigate(`/chat/${chatId}`);
  };

  return (
    <li className="ride-card">
      <Link to={`/individual-ride/${ride.id}`} className="ride-link">
        <strong>From:</strong> {ride.from} → <strong>To:</strong> {ride.to}
      </Link>

      <div className="ride-details">
        <p>
          <strong>Date:</strong> {ride.date}
        </p>
        <p>
          <strong>Time:</strong> {ride.time?.slice(0, 5)}
        </p>
        <p>
          <strong>Seats:</strong> {ride.seats}
        </p>
        {ride.notes && (
          <p className="ride-notes">
            <em>{ride.notes}</em>
          </p>
        )}
      </div>

      {ride.profiles && (
        <div className="poster-info">
          {ride.profiles.avatar_url ? (
            <img
              src={ride.profiles.avatar_url}
              alt={`${ride.profiles.nickname}'s avatar`}
              className="poster-avatar"
            />
          ) : (
            <div className="poster-avatar initial-avatar">
              {ride.profiles.nickname?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <Link to={`/profile/${ride.profiles.id}`} className="poster-nickname">
            <strong>{ride.profiles.nickname}</strong>
          </Link>
        </div>
      )}

      {user?.id !== ride.profiles.id && (
        <div className="ride-actions">
          <button onClick={handleStartChat} className="send-message-btn">
            Send Message
          </button>
        </div>
      )}

      <hr />
    </li>
  );
}
