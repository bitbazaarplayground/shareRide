// src/Components/RideCard.jsx
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import CheckInPanel from "./BookingFlow/CheckInPanel";

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
  bookingDetails = null, // supports legacy "booked" details; may be empty for "contributed"
  is_Host = false,
  lostHost = false,
  children, // <-- NEW: extra content (e.g., booking flow widgets) renders inside the <li>
}) {
  const navigate = useNavigate();
  const isOwner = !!(user && ride?.profiles?.id === user.id);

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [hours, minutes] = String(timeStr).split(":");
    const date = new Date();
    date.setHours(+hours || 0, +minutes || 0, 0, 0);
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

  // Confirm used for message/book/save when logged out
  const confirmAuthCta = () =>
    window.confirm(
      "You must be logged in to message or book a ride.\n\nWould you like to create an account for free?"
    );

  // Confirm used for username/profile when logged out
  const confirmAuthProfile = () =>
    window.confirm(
      "Please log in to view profiles.\n\nWould you like to create a free account?"
    );

  const requireAuthForCta = (action) => () => {
    if (user) return action();
    if (confirmAuthCta()) navigate("/signup");
  };

  const handleNicknameClick = () => {
    if (user) {
      navigate(`/profile/${ride.profiles.id}`);
    } else if (confirmAuthProfile()) {
      navigate("/signup");
    }
  };

  return (
    <div className="ride-card">
      {/* Header / poster */}
      {showAvatar && ride?.profiles && (
        <div className="avatar-header">
          {ride.profiles.avatar_url ? (
            <img
              src={ride.profiles.avatar_url}
              alt={`${ride.profiles.nickname || "User"}'s avatar`}
              className="ride-avatar"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="poster-avatar initial-avatar" aria-hidden="true">
              {ride.profiles.nickname?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="name-destination">
            <button
              type="button"
              className="poster-nickname clickable"
              onClick={handleNicknameClick}
              aria-label={
                user
                  ? `View ${ride.profiles.nickname}'s profile`
                  : "Log in to view profiles"
              }
            >
              {ride.profiles.nickname}
            </button>
          </div>
        </div>
      )}

      {/* Core details */}
      <div className="ride-locations">
        <strong>{ride.from}</strong> → <strong>{ride.to}</strong>
        {/* Tiny status badge */}
        {bookingDetails?.status === "pending" && (
          <span
            style={{
              fontSize: "0.8rem",
              color: "#b76e00",
              fontWeight: "600",
              marginLeft: "8px",
            }}
          >
            🟠 Pending
          </span>
        )}
        {bookingDetails?.status === "confirmed" && (
          <span
            style={{
              fontSize: "0.8rem",
              color: "green",
              fontWeight: "600",
              marginLeft: "8px",
            }}
          >
            🟢 Confirmed
          </span>
        )}
        {bookingDetails?.status === "canceled" && (
          <span
            style={{
              fontSize: "0.8rem",
              color: "red",
              fontWeight: "600",
              marginLeft: "8px",
            }}
          >
            🔴 Canceled
          </span>
        )}
      </div>

      <div className="ride-details">
        <p>
          <strong>Date:</strong> {formatDateWithWeekday(ride.date)}
        </p>

        <p>
          <strong>Time:</strong> {formatTime(ride.time)}
        </p>
        <p>
          <strong>Seats:</strong>{" "}
          {ride.seats ??
            ride.seats_total ??
            ride.seat_limit ??
            ride.max_passengers ??
            "—"}
        </p>
        {/* Booking Code */}
        {bookingDetails?.booking_code && (
          <p>
            <strong>Your Code:</strong> {bookingDetails.booking_code}
            <br />
            <small className="muted">
              Share this code once you meet your host. Do not share this code
              before meeting.
            </small>
          </p>
        )}

        {/* Optional: legacy "booked" details (payments table) */}
        {bookingDetails &&
          (bookingDetails.seats ||
            bookingDetails.backpacks ||
            bookingDetails.small ||
            bookingDetails.large) && (
            <>
              <p>
                <strong>Seats Booked:</strong> {bookingDetails.seats}
              </p>
              <p>
                <strong>Luggage:</strong>{" "}
                {[
                  bookingDetails.backpacks &&
                    `${bookingDetails.backpacks} backpack(s)`,
                  bookingDetails.small &&
                    `${bookingDetails.small} small suitcase(s)`,
                  bookingDetails.large &&
                    `${bookingDetails.large} large suitcase(s)`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </>
          )}
      </div>

      <div className="ride-actions">
        {(() => {
          function getUserRole(bookingDetails) {
            if (bookingDetails?.is_Host && !bookingDetails?.lost_host)
              return "active-host";
            if (bookingDetails?.lost_host) return "old-host";
            return "passenger";
          }

          const role = getUserRole(bookingDetails);

          // 🟢 ROLE A — Active Host
          if (role === "active-host") {
            return (
              <>
                <p className="success">👑 You are now the host of this ride.</p>
                <button
                  type="button"
                  onClick={() => onEdit?.(ride.id)}
                  className="edit-ride-btn"
                >
                  Confirm Ride
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(ride.id)}
                  className="delete-ride-btn"
                >
                  Cancel Ride
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/checkin/${ride.id}`)}
                  className="checkin-btn"
                >
                  Generate Check-In Code
                </button>

                {canSave && (
                  <button
                    type="button"
                    onClick={
                      user
                        ? () => onSaveToggle?.(ride.id)
                        : requireAuthForCta(() => {})
                    }
                    className="save-ride-btn"
                    aria-label={isSaved ? "Unsave ride" : "Save ride"}
                    title={
                      user
                        ? isSaved
                          ? "Unsave"
                          : "Save"
                        : "Log in to save rides"
                    }
                  >
                    {isSaved ? <FaHeart color="red" /> : <FaRegHeart />}
                  </button>
                )}
              </>
            );
          }

          // ⚠️ ROLE B — Old Host (lost host)
          if (role === "old-host") {
            return (
              <>
                <div className="expired-notice">
                  ⚠️ Host window expired — a new host has been assigned.
                </div>

                {onStartChat && (
                  <button
                    type="button"
                    onClick={
                      user
                        ? () => onStartChat(ride.profiles?.id, ride.id)
                        : requireAuthForCta(() => {})
                    }
                    className="send-message-btn"
                  >
                    Send Message
                  </button>
                )}

                <button
                  type="button"
                  onClick={
                    user
                      ? () => navigate(`/splitride-confirm/${ride.id}`)
                      : requireAuthForCta(() => {})
                  }
                  className="book-now-btn"
                >
                  Book Now
                </button>

                {canSave && (
                  <button
                    type="button"
                    onClick={
                      user
                        ? () => onSaveToggle?.(ride.id)
                        : requireAuthForCta(() => {})
                    }
                    className="save-ride-btn"
                    aria-label={isSaved ? "Unsave ride" : "Save ride"}
                    title={
                      user
                        ? isSaved
                          ? "Unsave"
                          : "Save"
                        : "Log in to save rides"
                    }
                  >
                    {isSaved ? <FaHeart color="red" /> : <FaRegHeart />}
                  </button>
                )}
              </>
            );
          }

          // 👥 ROLE C — Passenger / Normal Viewer
          return (
            <>
              {bookingDetails?.status === "pending" && (
                <div className="alert muted">
                  Pending — waiting for the host to confirm the ride.
                </div>
              )}

              {onStartChat && (
                <button
                  type="button"
                  onClick={
                    user
                      ? () => onStartChat(ride.profiles?.id, ride.id)
                      : requireAuthForCta(() => {})
                  }
                  className="send-message-btn"
                >
                  Send Message
                </button>
              )}

              {showBookNow && (
                <button
                  type="button"
                  onClick={
                    user
                      ? () => navigate(`/splitride-confirm/${ride.id}`)
                      : requireAuthForCta(() => {})
                  }
                  className="book-now-btn"
                >
                  Book Now
                </button>
              )}

              {canSave && (
                <button
                  type="button"
                  onClick={
                    user
                      ? () => onSaveToggle?.(ride.id)
                      : requireAuthForCta(() => {})
                  }
                  className="save-ride-btn"
                  aria-label={isSaved ? "Unsave ride" : "Save ride"}
                  title={
                    user
                      ? isSaved
                        ? "Unsave"
                        : "Save"
                      : "Log in to save rides"
                  }
                >
                  {isSaved ? <FaHeart color="red" /> : <FaRegHeart />}
                </button>
              )}
            </>
          );
        })()}
      </div>

      {/* Slot for extra UI (e.g., IssueCodePanel / CheckInPanel / ConfirmBookedButton) */}
      {children ? <div className="ride-card-extra">{children}</div> : null}
      {/* Host-only section */}
      {user && ride.profiles?.id === user.id && (
        <div className="host-section">
          <h4>Group Status</h4>
          <p>Group is ready?</p>
          <CheckInPanel rideId={ride.id} user={user} />
        </div>
      )}

      <hr />
    </div>
  );
}
