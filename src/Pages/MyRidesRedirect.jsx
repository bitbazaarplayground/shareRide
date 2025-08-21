// src/Pages/MyRidesRedirect.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmModal from "../Components/ConfirmModal";
import RideCard from "../Components/RideCard";
import { useAuth } from "../Contexts/AuthContext";
import useTabQueryParam from "../hooks/useTabQueryParam";
import { supabase } from "../supabaseClient";
import "./StylesPages/MyRidesRedirect.css";

// NEW: booking flow widgets
import CheckInPanel from "../Components/BookingFlow/CheckInPanel";
import ConfirmBookedButton from "../Components/BookingFlow/ConfirmBookedButton";
import IssueCodePanel from "../Components/BookingFlow/IssueCodePanel";

const TABS = ["published", "saved", "booked", "contributed"];

export default function MyRidesRedirect() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // keep ?tab= in sync
  const { activeTab, changeTab } = useTabQueryParam(TABS, "published");

  const [publishedRides, setPublishedRides] = useState([]);
  const [savedRides, setSavedRides] = useState([]);
  const [bookedRides, setBookedRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rideToDelete, setRideToDelete] = useState(null);
  const [contributedRides, setContributedRides] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchPublishedRides = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });
      if (!error) setPublishedRides(data || []);
    };

    const fetchSavedRides = async () => {
      const { data, error } = await supabase
        .from("saved_rides")
        .select("rides(*, profiles(*))")
        .eq("user_id", user.id);
      if (!error) setSavedRides((data || []).map((entry) => entry.rides));
    };
    const fetchContributedRides = async () => {
      const { data, error } = await supabase
        .from("ride_pool_contributions")
        .select(
          `
          id,
          ride_pools!inner(ride_id, rides(*, profiles(*))),
          user_share_minor,
          platform_fee_minor,
          checked_in_at,
          status
        `
        )
        .eq("user_id", user.id)
        .eq("status", "paid");

      if (!error) {
        const formatted = (data || []).map((entry) => ({
          ride: entry.ride_pools.rides,
          bookingDetails: {
            paid: true,
            share: entry.user_share_minor / 100,
            fee: entry.platform_fee_minor / 100,
            checkedIn: !!entry.checked_in_at,
          },
        }));
        setContributedRides(formatted);
      }
    };
    const fetchBookedRides = async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          `
          id,
          seats_booked,
          backpacks,
          small_suitcases,
          large_suitcases,
          rides(*, profiles(*))
        `
        )
        .eq("user_id", user.id);

      if (!error) {
        const formatted = (data || []).map((entry) => ({
          ride: entry.rides,
          bookingDetails: {
            seats: entry.seats_booked,
            backpacks: entry.backpacks,
            small: entry.small_suitcases,
            large: entry.large_suitcases,
          },
        }));
        setBookedRides(formatted);
      }
    };

    fetchPublishedRides();
    fetchSavedRides();
    fetchBookedRides();
    fetchContributedRides();
  }, [user]);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const activeRides = useMemo(
    () => publishedRides.filter((r) => r.date >= today),
    [publishedRides, today]
  );
  const pastRides = useMemo(
    () => publishedRides.filter((r) => r.date < today),
    [publishedRides, today]
  );

  const handleEdit = (rideId) => navigate(`/edit-ride/${rideId}`);

  const confirmDelete = (rideId) => {
    setRideToDelete(rideId);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!rideToDelete) return;

    setLoading(true);
    const { error } = await supabase
      .from("rides")
      .delete()
      .eq("id", rideToDelete);

    if (!error) {
      setPublishedRides((prev) => prev.filter((r) => r.id !== rideToDelete));
      toast.success("Ride deleted successfully.");
    } else {
      toast.error("Failed to delete ride.");
    }

    setConfirmOpen(false);
    setRideToDelete(null);
    setLoading(false);
  };

  const handleUnsave = async (rideId) => {
    const { error } = await supabase
      .from("saved_rides")
      .delete()
      .eq("user_id", user.id)
      .eq("ride_id", rideId);

    if (!error) {
      setSavedRides((prev) => prev.filter((r) => r.id !== rideId));
      toast.info("Ride removed from saved rides.");
    }
  };

  return (
    <div className="public-profile">
      <h2>My Rides</h2>

      <div className="tab-buttons">
        <button
          onClick={() => changeTab("published")}
          className={activeTab === "published" ? "active" : ""}
        >
          Published Rides
        </button>
        <button
          onClick={() => changeTab("saved")}
          className={activeTab === "saved" ? "active" : ""}
        >
          Saved Rides
        </button>
        <button
          onClick={() => changeTab("booked")}
          className={activeTab === "booked" ? "active" : ""}
        >
          Booked Rides
        </button>
        <button
          onClick={() => changeTab("contributed")}
          className={activeTab === "contributed" ? "active" : ""}
        >
          Contributed Rides
        </button>
      </div>

      {activeTab === "published" && (
        <div className="rides-section">
          <h3>Active Rides</h3>
          {activeRides.length > 0 ? (
            <ul className="ride-list">
              {activeRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  canEdit={true}
                  onEdit={handleEdit}
                  onDelete={() => confirmDelete(ride.id)}
                />
              ))}
            </ul>
          ) : (
            <p>No active rides.</p>
          )}

          <h3>Past Rides</h3>
          {pastRides.length > 0 ? (
            <ul className="ride-list">
              {pastRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  canEdit={true}
                  onEdit={handleEdit}
                  onDelete={() => confirmDelete(ride.id)}
                />
              ))}
            </ul>
          ) : (
            <p>No past rides.</p>
          )}
        </div>
      )}

      {activeTab === "saved" && (
        <div className="rides-section">
          {savedRides.length > 0 ? (
            <ul className="ride-list">
              {savedRides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  canSave={true}
                  isSaved={true}
                  showBookNow={true}
                  onStartChat={() => navigate(`/chat/${ride.profiles.id}`)}
                  onSaveToggle={handleUnsave}
                />
              ))}
            </ul>
          ) : (
            <p>No saved rides.</p>
          )}
        </div>
      )}
      {activeTab === "contributed" && (
        <div className="rides-section">
          {contributedRides.length > 0 ? (
            <ul className="ride-list">
              {contributedRides.map(({ ride, bookingDetails }) => (
                <li key={ride.id} className="ride-list-item">
                  <RideCard
                    ride={ride}
                    user={user}
                    bookingDetails={bookingDetails}
                    onStartChat={() => navigate(`/chat/${ride.profiles.id}`)}
                  />
                  <div className="booking-flow-widgets">
                    <CheckInPanel rideId={ride.id} user={user} />
                    <ConfirmBookedButton rideId={ride.id} user={user} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No contributed rides found.</p>
          )}
        </div>
      )}
      {activeTab === "booked" && (
        <div className="rides-section">
          {bookedRides.length > 0 ? (
            <ul className="ride-list">
              {bookedRides.map(({ ride, bookingDetails }) => (
                <li key={ride.id} className="ride-list-item">
                  <RideCard
                    ride={ride}
                    user={user}
                    bookingDetails={bookingDetails}
                    onStartChat={() => navigate(`/chat/${ride.profiles.id}`)}
                  />

                  {/* ---- Booking Flow widgets ---- */}
                  <div className="booking-flow-widgets">
                    {/* Booker: generate/share code */}
                    <IssueCodePanel rideId={ride.id} user={user} />

                    {/* Everyone: enter the code to check-in when active */}
                    <CheckInPanel rideId={ride.id} user={user} />

                    {/* Booker: confirm booked (trigger reimbursement) */}
                    <ConfirmBookedButton rideId={ride.id} user={user} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No booked rides.</p>
          )}
        </div>
      )}

      <ToastContainer position="top-center" autoClose={2500} />
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        message="Are you sure you want to delete this ride?"
      />
    </div>
  );
}
