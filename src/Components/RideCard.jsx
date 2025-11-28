// src/Components/RideCard.jsx
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import CheckInPanel from "./BookingFlow/CheckInPanel";
import "./Styles/RideCard.css";

export default function RideCard({
  ride,
  user,
  showAvatar = true,

  // Owner tools
  canEdit = false,
  onEdit,
  onDelete,
  showHostTools = false,

  // Passenger actions
  onStartChat,
  onRequestJoin,

  // Save feature
  canSave = false,
  isSaved = false,
  onSaveToggle,

  children,
}) {
  const navigate = useNavigate();
  const isOwner = user && ride?.profiles?.id === user?.id;

  /* ------------------------------------
       DATE & TIME HELPERS
  ------------------------------------ */
  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [h, m] = String(timeStr).split(":");
    return new Date(0, 0, 0, h, m)
      .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      .replace(/^0/, "");
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  /* ------------------------------------
   SEAT & PRICE HELPERS
------------------------------------ */
  const capacity =
    Number(ride.seat_limit ?? ride.seats_total ?? ride.max_passengers ?? 0) ||
    0;

  const hostSeats = Number(ride.seats ?? 1);

  const acceptedPassengerSeats = Array.isArray(ride.ride_requests)
    ? ride.ride_requests
        .filter((r) => r.status === "accepted")
        .reduce((sum, r) => sum + Number(r.seats || 0), 0)
    : 0;

  const totalTakenSeats = hostSeats + acceptedPassengerSeats;

  const availableSeats =
    capacity > 0 ? Math.max(0, capacity - totalTakenSeats) : null;

  // estimated_fare is total ride fare → divide by seat capacity
  const pricePerPassenger =
    ride.estimated_fare && capacity > 0
      ? Number(ride.estimated_fare) / capacity
      : null;

  /* ------------------------------------
       AUTH CHECK
  ------------------------------------ */
  const requireAuth = (action) => () => {
    if (user) return action();
    if (window.confirm("Please log in to continue.\nCreate a free account?")) {
      navigate("/signup");
    }
  };

  return (
    <div className="ride-card">
      {/* HOST AVATAR + NAME */}
      {showAvatar && ride?.profiles && (
        <div className="avatar-header">
          {ride.profiles.avatar_url ? (
            <img
              src={ride.profiles.avatar_url}
              alt={`${ride.profiles.nickname} avatar`}
              className="ride-avatar"
            />
          ) : (
            <div className="ride-avatar placeholder">
              {ride.profiles.nickname?.slice(0, 1).toUpperCase() || "?"}
            </div>
          )}

          <button
            type="button"
            className="poster-nickname clickable"
            onClick={
              user
                ? () => navigate(`/profile/${ride.profiles.id}`)
                : requireAuth(() => {})
            }
          >
            {ride.profiles.nickname}
          </button>
        </div>
      )}

      {/* DESTINATION */}
      <div className="ride-locations">
        <strong>{ride.from}</strong> → <strong>{ride.to}</strong>
      </div>

      {/* BASIC RIDE DETAILS */}
      <div className="ride-details">
        <p>
          <strong>Date:</strong> {formatDate(ride.date)}
        </p>
        <p>
          <strong>Time:</strong> {formatTime(ride.time)}
        </p>

        {/* ✅ Available seats for passengers */}
        {availableSeats !== null && (
          <p>
            <strong>Available Seats:</strong> {availableSeats}
          </p>
        )}

        {/* ✅ Price per passenger */}
        {pricePerPassenger !== null && (
          <p>
            <strong>Price Per Passenger:</strong> £
            {pricePerPassenger.toFixed(2)}
          </p>
        )}

        {/* {ride.vehicle_type && (
          <p>
            <strong>Vehicle:</strong> {ride.vehicle_type}
          </p>
        )} */}

        {ride.notes && (
          <p className="muted notes">
            <strong>Notes:</strong> {ride.notes}
          </p>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="ride-actions">
        {isOwner ? (
          <>
            {canEdit && (
              <button
                className="edit-ride-btn"
                onClick={() => onEdit?.(ride.id)}
              >
                Edit Ride
              </button>
            )}

            {onDelete && (
              <button
                className="delete-ride-btn"
                onClick={() => onDelete?.(ride.id)}
              >
                Delete Ride
              </button>
            )}

            <button
              className="manage-ride-btn"
              onClick={() => navigate(`/host/ride/${ride.id}`)}
            >
              Manage Ride
            </button>
          </>
        ) : (
          <>
            {onStartChat && (
              <button
                className="send-message-btn"
                onClick={
                  user
                    ? () => onStartChat(ride.profiles?.id, ride.id)
                    : requireAuth(() => {})
                }
              >
                Send Message
              </button>
            )}

            {onRequestJoin && (
              <button
                className="request-join-btn"
                onClick={
                  user ? () => onRequestJoin(ride.id) : requireAuth(() => {})
                }
              >
                Request to Join
              </button>
            )}

            {canSave && (
              <button
                className="save-ride-btn"
                onClick={
                  user ? () => onSaveToggle(ride.id) : requireAuth(() => {})
                }
              >
                {isSaved ? <FaHeart className="heart saved" /> : <FaRegHeart />}
              </button>
            )}
          </>
        )}
      </div>

      {children && <div className="ride-card-extra">{children}</div>}

      {showHostTools && isOwner && (
        <div className="host-section">
          <h4>Group Status</h4>
          <CheckInPanel rideId={ride.id} user={user} />
        </div>
      )}
    </div>
  );
}
