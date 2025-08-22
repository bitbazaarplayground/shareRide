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

const TABS = ["published", "saved", "booked"];

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

    // NEW: Booked rides from ride_pool_contributions (status=paid)
    const fetchBookedRides = async () => {
      // 1) user’s paid contributions
      const { data: contribs, error: cErr } = await supabase
        .from("ride_pool_contributions")
        .select(
          "id, ride_pool_id, user_share_minor, platform_fee_minor, checked_in_at, status"
        )
        .eq("user_id", user.id)
        .eq("status", "paid");

      if (cErr) {
        console.warn("contribs error:", cErr);
        setBookedRides([]);
        return;
      }
      if (!contribs || contribs.length === 0) {
        setBookedRides([]);
        return;
      }

      // 2) pools for those contributions
      const poolIds = [...new Set(contribs.map((c) => c.ride_pool_id))];
      const { data: pools, error: pErr } = await supabase
        .from("ride_pools")
        .select("id, ride_id, status, min_contributors")
        .in("id", poolIds);

      if (pErr) {
        console.warn("pools error:", pErr);
        setBookedRides([]);
        return;
      }

      // 3) rides for those pools
      const rideIds = [
        ...new Set((pools || []).map((p) => p.ride_id).filter(Boolean)),
      ];
      if (rideIds.length === 0) {
        setBookedRides([]);
        return;
      }
      const { data: rides, error: rErr } = await supabase
        .from("rides")
        .select("*, profiles(*)")
        .in("id", rideIds);

      if (rErr) {
        console.warn("rides error:", rErr);
        setBookedRides([]);
        return;
      }

      // 4) combine
      const byPoolId = Object.fromEntries((pools || []).map((p) => [p.id, p]));
      const byRideId = Object.fromEntries((rides || []).map((r) => [r.id, r]));

      const formatted = contribs
        .map((c) => {
          const pool = byPoolId[c.ride_pool_id];
          const ride = byRideId[pool?.ride_id];
          if (!ride) return null;
          return {
            ride,
            pool,
            bookingDetails: {
              paid: c.status === "paid",
              share: (c.user_share_minor || 0) / 100,
              fee: (c.platform_fee_minor || 0) / 100,
              checkedIn: !!c.checked_in_at,
            },
          };
        })
        .filter(Boolean);

      setBookedRides(formatted);
    };

    fetchPublishedRides();
    fetchSavedRides();
    fetchBookedRides();
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

      {activeTab === "booked" && (
        <div className="rides-section">
          {bookedRides.length > 0 ? (
            <ul className="ride-list">
              {bookedRides.map(({ ride, bookingDetails, pool }) => (
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
            <p>No booked rides yet.</p>
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
