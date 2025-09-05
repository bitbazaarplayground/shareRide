// src/Pages/AllPostedRides.jsx
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmModal from "../Components/ConfirmModal";
import RideCard from "../Components/RideCard";
import SearchBar from "../Components/SearchBar";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/AllPostedRides.css";

export default function AllPostedRides() {
  const { i18n } = useTranslation();
  const [rides, setRides] = useState([]);
  const [savedRideIds, setSavedRideIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rideToDelete, setRideToDelete] = useState(null);

  const [passengerCount, setPassengerCount] = useState(1);
  const [backpacks, setBackpacks] = useState(0);
  const [smallSuitcases, setSmallSuitcases] = useState(0);
  const [largeSuitcases, setLargeSuitcases] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const successMessage = location.state?.message;

  // Parse YYYY-MM-DD + HH:mm[:ss] as a LOCAL Date (avoids timezone surprises)
  const parseLocalDateTime = (dateStr, timeStr) => {
    if (!dateStr || !timeStr) return null;
    const [y, m, d] = String(dateStr)
      .split("-")
      .map((n) => Number(n));
    const [hh, mm = "0", ss = "0"] = String(timeStr).split(":");
    const dt = new Date(
      Number(y),
      Number(m) - 1,
      Number(d),
      Number(hh),
      Number(mm),
      Number(ss)
    );
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  useEffect(() => {
    async function fetchRides() {
      const { data, error } = await supabase
        .from("rides")
        .select("*, profiles(id, nickname, avatar_url)")
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (error) {
        setErrorMsg("Failed to fetch rides.");
        console.error("Error fetching rides:", error);
        setLoading(false);
        return;
      }

      // Helpers: non-breaking fallbacks for capacity/luggage fields
      const getRemainingSeats = (ride) =>
        Number(
          ride.seats ??
            ride.seats_total ??
            ride.seat_limit ??
            ride.max_passengers ??
            0
        );

      const getBackpacks = (ride) => Number(ride.backpack_count ?? 0);
      const getSmall = (ride) => Number(ride.small_suitcase_count ?? 0);
      const getLarge = (ride) => Number(ride.large_suitcase_count ?? 0);

      // Show rides that are NOW or in the FUTURE (hide past rides)
      const now = new Date();
      const timeFiltered = (data || []).filter((ride) => {
        const rideDateTime = parseLocalDateTime(ride.date, ride.time);
        if (!rideDateTime) return false; // require valid date+time to show
        return rideDateTime >= now;
      });

      // Apply seat/luggage filters
      const matchingRides = timeFiltered.filter((ride) => {
        const remainingSeats = getRemainingSeats(ride);

        const hasDetailedLuggageFields =
          ride.backpack_count != null ||
          ride.small_suitcase_count != null ||
          ride.large_suitcase_count != null;

        if (hasDetailedLuggageFields) {
          return (
            remainingSeats >= passengerCount &&
            getBackpacks(ride) >= backpacks &&
            getSmall(ride) >= smallSuitcases &&
            getLarge(ride) >= largeSuitcases
          );
        } else if (ride.luggage_limit != null) {
          const totalRequestedLuggage =
            backpacks + smallSuitcases + largeSuitcases;
          return (
            remainingSeats >= passengerCount &&
            Number(ride.luggage_limit ?? 0) >= totalRequestedLuggage
          );
        }

        return remainingSeats >= passengerCount;
      });

      setRides(matchingRides);
      setLoading(false);
    }

    fetchRides();
  }, [passengerCount, backpacks, smallSuitcases, largeSuitcases]);

  useEffect(() => {
    async function fetchSavedRides() {
      if (!user?.id) {
        setSavedRideIds([]);
        return;
      }
      const { data, error } = await supabase
        .from("saved_rides")
        .select("ride_id")
        .eq("user_id", user.id);

      if (!error && data) {
        setSavedRideIds(data.map((entry) => entry.ride_id));
      }
    }
    fetchSavedRides();
  }, [user?.id]);

  const toggleSaveRide = async (rideId) => {
    if (!user?.id) return;
    if (savedRideIds.includes(rideId)) {
      await supabase
        .from("saved_rides")
        .delete()
        .eq("ride_id", rideId)
        .eq("user_id", user.id);
      setSavedRideIds((prev) => prev.filter((id) => id !== rideId));
      toast.info("Ride removed from saved rides.");
    } else {
      await supabase
        .from("saved_rides")
        .insert([{ ride_id: rideId, user_id: user.id }]);
      setSavedRideIds((prev) => [...prev, rideId]);
      toast.success("Ride saved successfully!");
    }
  };

  const confirmDelete = (rideId) => {
    setRideToDelete(rideId);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!rideToDelete) return;
    const { error } = await supabase
      .from("rides")
      .delete()
      .eq("id", rideToDelete);
    if (error) {
      console.error("Error deleting ride:", error);
      toast.error("Failed to delete the ride.");
    } else {
      setRides((prev) => prev.filter((ride) => ride.id !== rideToDelete));
      toast.success("Ride deleted successfully.");
    }
    setConfirmOpen(false);
    setRideToDelete(null);
  };

  const handleStartChat = async (ridePosterId, rideId) => {
    if (!user?.id) return;
    const userA = user.id < ridePosterId ? user.id : ridePosterId;
    const userB = user.id < ridePosterId ? ridePosterId : user.id;

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

    navigate(`/messages/${chatId}`);
  };

  return (
    <>
      <Helmet htmlAttributes={{ lang: i18n.language || "en-GB" }}>
        <title>All Rides — TabFair</title>
        <meta
          name="description"
          content="Browse all posted rides. Filter by origin, destination, date, and luggage."
        />
        <link
          rel="canonical"
          href="https://jade-rolypoly-5d4274.netlify.app/all-rides"
        />
      </Helmet>

      <section className="hero-header" aria-label="Browse all rides">
        <picture className="hero-media">
          <source
            type="image/avif"
            srcSet="/images/allrides/all-rides-480.avif 480w,
            /images/allrides/all-rides-1024.avif 1024w,
            /images/allrides/all-rides-1600.avif 1600w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/images/allrides/all-rides-480.webp 480w,
            /images/allrides/all-rides-1024.webp 1024w,
            /images/allrides/all-rides-1600.webp 1600w"
            sizes="100vw"
          />
          <img
            src="/images/allrides/all-rides-1600.jpg"
            srcSet="/images/allrides/all-rides-480.jpg 480w,
            /images/allrides/all-rides-1024.jpg 1024w,
            /images/allrides/all-rides-1600.jpg 1600w"
            sizes="100vw"
            alt=""
            width="1600"
            height="500"
            loading="eager"
            decoding="async"
            fetchpriority="high"
            className="hero-img"
          />
        </picture>

        <div className="overlay-content">
          <SearchBar
            passengerCount={passengerCount}
            setPassengerCount={setPassengerCount}
            backpacks={backpacks}
            setBackpacks={setBackpacks}
            smallSuitcases={smallSuitcases}
            setSmallSuitcases={setSmallSuitcases}
            largeSuitcases={largeSuitcases}
            setLargeSuitcases={setLargeSuitcases}
          />
        </div>
      </section>

      <div className="rides-page-wrapper">
        {successMessage && <p className="success">{successMessage}</p>}

        <div className="all-rides-container">
          {loading ? (
            <p>Loading rides...</p>
          ) : errorMsg ? (
            <p>{errorMsg}</p>
          ) : rides.length === 0 ? (
            <p>No rides have been published yet.</p>
          ) : (
            <ul className="ride-list">
              {rides.map((ride) => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  user={user}
                  isSaved={savedRideIds.includes(ride.id)}
                  canSave={true}
                  canEdit={user?.id === ride.profiles?.id}
                  /* 👇 Show Book button to everyone (hidden only for owner when logged in) */
                  showBookNow={ride.profiles?.id !== user?.id}
                  onSaveToggle={toggleSaveRide}
                  onDelete={() => confirmDelete(ride.id)}
                  onEdit={(id) => navigate(`/edit-ride/${id}`)}
                  onStartChat={handleStartChat}
                />
              ))}
            </ul>
          )}
        </div>

        <ToastContainer position="top-center" autoClose={2500} />

        <ConfirmModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={handleConfirmDelete}
          message="Are you sure you want to delete this ride?"
        />
      </div>
    </>
  );
}
