import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";

export default function IndividualRide() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRideWithUser() {
      const { data, error } = await supabase
        .from("rides")
        .select("*, profiles(id, nickname, avatar_url)")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching ride:", error);
      } else {
        setRide(data);
      }

      setLoading(false);
    }

    fetchRideWithUser();
  }, [id]);

  const handleMessageClick = async () => {
    if (!user || !ride?.profiles?.id) return;

    const userA = user.id;
    const userB = ride.profiles.id;

    // Always order user ids to prevent duplicates (userA < userB)
    const [participant1, participant2] =
      userA < userB ? [userA, userB] : [userB, userA];

    // Check if a chat already exists
    const { data: existingChat, error: chatError } = await supabase
      .from("chats")
      .select("id")
      .eq("user1", participant1)
      .eq("user2", participant2)
      .single();

    if (chatError && chatError.code !== "PGRST116") {
      // Only log error if it's not "no rows found"
      console.error("Error checking existing chat:", chatError);
      return;
    }

    let chatId;

    if (existingChat) {
      chatId = existingChat.id;
    } else {
      const { data: newChat, error: createError } = await supabase
        .from("chats")
        .insert([{ user1: participant1, user2: participant2 }])
        .select()
        .single();

      if (createError) {
        console.error("Error creating new chat:", createError);
        return;
      }

      chatId = newChat.id;
    }

    // Redirect to the chat page
    navigate(`/chat/${chatId}`);
  };

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
      {ride.profiles ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={ride.profiles.avatar_url || "/default-avatar.png"}
            alt={`${ride.profiles.nickname}'s avatar`}
            style={{ width: "40px", height: "40px", borderRadius: "50%" }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Link to={`/profile/${ride.profiles.id}`}>
              <strong>{ride.profiles.nickname}</strong>
            </Link>

            {user?.id !== ride.profiles.id && (
              <button className="btn white" onClick={handleMessageClick}>
                Message
              </button>
            )}
          </div>
        </div>
      ) : (
        <p>User info not available.</p>
      )}
    </div>
  );
}
