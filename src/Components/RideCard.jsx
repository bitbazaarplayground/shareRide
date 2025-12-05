// src/Components/RideCard.jsx
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import CheckInPanel from "./BookingFlow/CheckInPanel";
import "./Styles/RideCard.css";

export default function RideCard({
  ride,
  user,
  showAvatar = true,

  // Used only in published/saved views
  onStartChat,
  onRequestJoin,
  canSave = false,
  isSaved = false,
  onSaveToggle,

  // NEW — for booked rides
  depositStatus,
  checkinCode,
  checkedIn,

  children,
}) {
  const navigate = useNavigate();

  /* ----------------------------------------------------------
     1) FIXED: Some rides (from deposits) DO NOT have profiles
  ----------------------------------------------------------- */
  const hostProfile = ride.profiles || null;
  const isOwner = user && hostProfile && hostProfile.id === user.id;

  /* ----------------------------------------------------------
     DATE & TIME HELPERS
  ----------------------------------------------------------- */
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

  /* ----------------------------------------------------------
     SEAT & PRICE LOGIC — only valid for Host-published rides
  ----------------------------------------------------------- */
  const TAXI_CAPACITY = 4;

  const hostSeats = Number(ride.seats ?? 1);

  const acceptedPassengersSeats = Array.isArray(ride.ride_requests)
    ? ride.ride_requests
        .filter((r) => r.status === "accepted")
        .reduce((sum, r) => sum + Number(r.seats || 0), 0)
    : 0;

  const totalTaken = hostSeats + acceptedPassengersSeats;
  const availableSeats = Math.max(0, TAXI_CAPACITY - totalTaken);

  const pricePerSeat =
    ride.estimated_fare > 0
      ? (Number(ride.estimated_fare) / TAXI_CAPACITY).toFixed(2)
      : null;

  /* ----------------------------------------------------------
     AUTH HANDLING
  ----------------------------------------------------------- */
  const requireAuth = (action) => () => {
    if (user) return action();
    if (window.confirm("Please log in to continue.\nCreate a free account?")) {
      navigate("/signup");
    }
  };

  return (
    <div className="ride-card">
      {/* ===========================
          FOR BOOKED RIDES ONLY
      ============================ */}
      {depositStatus && (
        <div className="badge booked-badge">
          {depositStatus === "paid" ? "Paid Ride" : "Pending Payment"}
        </div>
      )}

      {/* HOST AVATAR + NAME */}
      {showAvatar && hostProfile && (
        <div className="avatar-header">
          {hostProfile.avatar_url ? (
            <img
              src={hostProfile.avatar_url}
              alt={`${hostProfile.nickname} avatar`}
              className="ride-avatar"
            />
          ) : (
            <div className="ride-avatar placeholder">
              {hostProfile.nickname?.[0]?.toUpperCase() || "?"}
            </div>
          )}

          <button
            type="button"
            className="poster-nickname clickable"
            onClick={
              user
                ? () => navigate(`/profile/${hostProfile.id}`)
                : requireAuth(() => {})
            }
          >
            {hostProfile.nickname}
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

        {/* Only show seat availability for published rides */}
        {!depositStatus && (
          <p>
            <strong>Available Seats:</strong> {availableSeats}
          </p>
        )}

        {pricePerSeat && !depositStatus && (
          <p>
            <strong>Price Per Passenger:</strong> £{pricePerSeat}
          </p>
        )}

        {ride.notes && (
          <p className="muted notes">
            <strong>Notes:</strong> {ride.notes}
          </p>
        )}
      </div>

      {/* ACTION BUTTONS (only for non-booked views) */}
      {!depositStatus && (
        <div className="ride-actions">
          {isOwner ? (
            <button
              className="manage-ride-btn"
              onClick={() => navigate(`/host/ride/${ride.id}`)}
            >
              Manage Ride
            </button>
          ) : (
            <>
              {onStartChat && (
                <button
                  className="send-message-btn"
                  onClick={
                    user
                      ? () => onStartChat(hostProfile?.id, ride.id)
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
      )}

      {/* EXTRA CONTENT (Manage Ride) */}
      {children && <div className="ride-card-extra">{children}</div>}

      {/* HOST CHECK-IN PANEL (ONLY for host) */}
      {isOwner && !depositStatus && (
        <div className="host-section">
          <h4>Group Status</h4>
          <CheckInPanel rideId={ride.id} user={user} />
        </div>
      )}
    </div>
  );
}
