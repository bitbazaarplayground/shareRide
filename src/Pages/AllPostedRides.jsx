import React, { useEffect, useState } from "react";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import SearchBar from "../Components/SearchBar";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/AllPostedRides.css";

export default function AllPostedRides() {
  const [rides, setRides] = useState([]);
  const [savedRideIds, setSavedRideIds] = useState([]);
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
        setLoading(false);
        return;
      }

      const now = new Date();

      const filteredRides = data.filter((ride) => {
        if (!ride.date || !ride.time) return false;

        const rideDateTime = new Date(`${ride.date}T${ride.time}`);
        return rideDateTime >= now;
      });

      setRides(filteredRides);
      setLoading(false);
    }

    fetchRides();
  }, []);

  useEffect(() => {
    async function fetchSavedRides() {
      if (!user) return;
      const { data, error } = await supabase
        .from("saved_rides")
        .select("ride_id")
        .eq("user_id", user.id);

      if (!error && data) {
        setSavedRideIds(data.map((entry) => entry.ride_id));
      }
    }
    fetchSavedRides();
  }, [user]);

  const toggleSaveRide = async (rideId) => {
    if (savedRideIds.includes(rideId)) {
      await supabase
        .from("saved_rides")
        .delete()
        .eq("ride_id", rideId)
        .eq("user_id", user.id);
      setSavedRideIds((prev) => prev.filter((id) => id !== rideId));
    } else {
      await supabase.from("saved_rides").insert([
        {
          ride_id: rideId,
          user_id: user.id,
        },
      ]);
      setSavedRideIds((prev) => [...prev, rideId]);
    }
  };

  function formatTime(timeStr) {
    if (!timeStr) return "N/A";
    const [hours, minutes] = timeStr.split(":");
    const date = new Date();
    date.setHours(+hours);
    date.setMinutes(+minutes);

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function formatDateWithWeekday(dateStr) {
    if (!dateStr) return "N/A";
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

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
              {ride.profiles && (
                <div className="avatar-header">
                  {ride.profiles.avatar_url ? (
                    <img
                      src={ride.profiles.avatar_url}
                      alt={`${ride.profiles.nickname}'s avatar`}
                    />
                  ) : (
                    <div className="poster-avatar initial-avatar">
                      {ride.profiles.nickname?.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="name-destination">
                    <span
                      className="poster-nickname clickable"
                      onClick={() => {
                        if (user) {
                          navigate(`/profile/${ride.profiles.id}`);
                        } else {
                          alert("You must be logged in to view user profiles.");
                        }
                      }}
                    >
                      {ride.profiles.nickname}
                    </span>
                    <span className="separator">|</span>
                    <span>
                      {ride.from} → {ride.to}
                    </span>
                  </div>
                </div>
              )}

              <div className="ride-details">
                <p>
                  <strong>Date:</strong> {formatDateWithWeekday(ride.date)}
                </p>
                <p>
                  <strong>Time:</strong> {formatTime(ride.time)}
                </p>
                <p>
                  <strong>Seats:</strong> {ride.seats}
                </p>
              </div>

              {ride.notes && (
                <p className="ride-notes">
                  <em>{ride.notes}</em>
                </p>
              )}

              <div className="ride-actions">
                {user ? (
                  user.id !== ride.profiles.id ? (
                    <>
                      <button
                        onClick={() =>
                          handleStartChat(ride.profiles.id, ride.id)
                        }
                        className="send-message-btn"
                      >
                        Send Message
                      </button>
                      <button
                        onClick={() =>
                          navigate(`/splitride-confirm/${ride.id}`)
                        }
                        className="book-now-btn"
                      >
                        Book Now
                      </button>
                      <button
                        onClick={() => toggleSaveRide(ride.id)}
                        className="save-ride-btn"
                      >
                        {savedRideIds.includes(ride.id) ? (
                          <FaHeart color="red" />
                        ) : (
                          <FaRegHeart />
                        )}
                      </button>
                    </>
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
                  )
                ) : (
                  <>
                    <button
                      onClick={() =>
                        alert("Please log in to message the ride poster.")
                      }
                      className="send-message-btn"
                    >
                      Send Message
                    </button>
                    <button
                      onClick={() => alert("Please log in to book this ride.")}
                      className="book-now-btn"
                    >
                      Book Now
                    </button>
                    <button
                      onClick={() => alert("Please log in to save this ride.")}
                      className="save-ride-btn"
                    >
                      <FaRegHeart />
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
