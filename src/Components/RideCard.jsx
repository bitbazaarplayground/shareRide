// src/Components/RideCard.jsx
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import CheckInPanel from "./BookingFlow/CheckInPanel";
import "./Styles/RideCard.css";

export default function RideCard({
  ride,
  user,
  showAvatar = true,

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
       SEAT & PRICE LOGIC (Taxi = 4 seats)
  ------------------------------------ */
  const TAXI_CAPACITY = 4;

  const hostSeats = Number(ride.seats ?? 1);

  const acceptedPassengersSeats = Array.isArray(ride.ride_requests)
    ? ride.ride_requests
        .filter((r) => r.status === "accepted")
        .reduce((sum, r) => sum + Number(r.seats || 0), 0)
    : 0;

  const totalTaken = hostSeats + acceptedPassengersSeats;

  const availableSeats = Math.max(0, TAXI_CAPACITY - totalTaken);

  // Price per seat (total ride fare / 4)
  const estimatedFare = Number(ride.estimated_fare || 0);
  const pricePerSeat =
    estimatedFare > 0 ? (estimatedFare / TAXI_CAPACITY).toFixed(2) : null;

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

        {/* Available seats */}
        <p>
          <strong>Available Seats:</strong> {availableSeats}
        </p>

        {/* Price per passenger */}
        {pricePerSeat && (
          <p>
            <strong>Price Per Passenger:</strong> £{pricePerSeat}
          </p>
        )}

        {/* Notes */}
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
            <button
              className="manage-ride-btn"
              onClick={() => navigate(`/host/ride/${ride.id}`)}
            >
              Manage Ride
            </button>
          </>
        ) : (
          <>
            {/* Send Message */}
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

            {/* Request to Join */}
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

            {/* Save */}
            {canSave && (
              <button
                className="save-ride-btn"
                onClick={
                  user ? () => onSaveToggle(ride.id) : requireAuth(() => {})
                }
              >
                {isSaved ? (
                  <FaHeart className="heart saved" />
                ) : (
                  <FaRegHeart className="heart" />
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Extra content (Host Manage Ride inserts content) */}
      {children && <div className="ride-card-extra">{children}</div>}

      {isOwner && (
        <div className="host-section">
          <h4>Group Status</h4>
          <CheckInPanel rideId={ride.id} user={user} />
        </div>
      )}
    </div>
  );
}
