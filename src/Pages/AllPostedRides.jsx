import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import SearchBar from "../Components/SearchBar";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/AllPostedRides.css";

export default function AllPostedRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const successMessage = location.state?.message;

  useEffect(() => {
    async function fetchRides() {
      const { data, error } = await supabase
        .from("rides")
        .select("*, profiles(id, nickname, avatar_url)")
        .order("date", { ascending: true });

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

  const handleDelete = async (rideId) => {
    const { error } = await supabase.from("rides").delete().eq("id", rideId);
    if (error) {
      console.error("Error deleting ride:", error);
    } else {
      setRides((prev) => prev.filter((ride) => ride.id !== rideId));
    }
  };

  const handleStartChat = async (ridePosterId, rideId) => {
    const [userA, userB] =
      user.id < ridePosterId
        ? [user.id, ridePosterId]
        : [ridePosterId, user.id];

    const { data: existingChat, error: fetchError } = await supabase
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

  return (
    <div className="all-rides-container">
      <SearchBar variant="horizontal" />
      {successMessage && <p className="success">{successMessage}</p>}
      {loading ? (
        <p>Loading rides...</p>
      ) : errorMsg ? (
        <p>{errorMsg}</p>
      ) : rides.length === 0 ? (
        <p>No rides have been published yet.</p>
      ) : (
        <ul className="ride-list">
          {rides.map((ride) => (
            <li key={ride.id} className="ride-card">
              <Link to={`/individual-ride/${ride.id}`} className="ride-link">
                <strong>From:</strong> {ride.from} → <strong>To:</strong>{" "}
                {ride.to}
              </Link>
              <div className="ride-details">
                <p>
                  <strong>Date:</strong> {ride.date}
                </p>
                <p>
                  <strong>Seats:</strong> {ride.seats}
                </p>
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
                  <Link
                    to={`/profile/${ride.profiles.id}`}
                    className="poster-nickname"
                  >
                    <strong>{ride.profiles.nickname}</strong>
                  </Link>
                </div>
              )}
              {ride.notes && (
                <p className="ride-notes">
                  <em>{ride.notes}</em>
                </p>
              )}
              <div className="ride-actions">
                {user?.id !== ride.profiles.id ? (
                  <button
                    onClick={() => handleStartChat(ride.profiles.id, ride.id)}
                    className="send-message-btn"
                  >
                    Send Message
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => navigate(`/edit-ride/${ride.id}`)}
                      className="edit-ride-btn"
                    >
                      Edit Ride
                    </button>
                    <button
                      onClick={() => handleDelete(ride.id)}
                      className="delete-ride-btn"
                    >
                      Delete Ride
                    </button>
                  </>
                )}
              </div>

              <hr />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
