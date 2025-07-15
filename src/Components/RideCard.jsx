// RideCard.jsx
import React from "react";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "./Styles/RideCard.css";

export default function RideCard({
  ride,
  user,
  showAvatar = true,
  canEdit = false,
  canSave = false,
  isSaved = false,
  onEdit,
  onDelete,
  onSaveToggle,
  onStartChat,
  showBookNow = false,
}) {
  const navigate = useNavigate();

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [hours, minutes] = timeStr.split(":");
    const date = new Date();
    date.setHours(+hours, +minutes);
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDateWithWeekday = (dateStr) => {
    if (!dateStr) return "N/A";
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <li className="ride-card">
      {showAvatar && ride.profiles && (
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
                if (user) navigate(`/profile/${ride.profiles.id}`);
                else alert("Please log in to view profiles.");
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
        {ride.notes && (
          <p className="ride-notes">
            <em>{ride.notes}</em>
          </p>
        )}
      </div>

      <div className="ride-actions">
        {canEdit ? (
          <>
            <button onClick={() => onEdit(ride.id)} className="edit-ride-btn">
              Edit Ride
            </button>
            <button
              onClick={() => onDelete(ride.id)}
              className="delete-ride-btn"
            >
              Delete Ride
            </button>
          </>
        ) : (
          <>
            {user && ride.profiles?.id !== user.id && (
              <>
                {onStartChat && (
                  <button
                    onClick={() => onStartChat(ride.profiles.id, ride.id)}
                    className="send-message-btn"
                  >
                    Send Message
                  </button>
                )}
                {showBookNow && (
                  <button
                    onClick={() => navigate(`/splitride-confirm/${ride.id}`)}
                    className="book-now-btn"
                  >
                    Book Now
                  </button>
                )}
                {canSave && onSaveToggle && (
                  <button
                    onClick={() => onSaveToggle(ride.id)}
                    className="save-ride-btn"
                  >
                    {isSaved ? <FaHeart color="red" /> : <FaRegHeart />}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>

      <hr />
    </li>
  );
}
