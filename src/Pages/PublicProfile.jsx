import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Avatar from "../Components/Avatar";
import RideCard from "../Components/RideCard";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profileData, setProfileData] = useState(null);
  const [rides, setRides] = useState([]);
  const [showImage, setShowImage] = useState(false);

  // ---------------- Fetch Profile + Rides ----------------
  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      if (error) console.error("Error fetching profile:", error);
      else setProfileData(data);
    };

    const fetchRides = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .eq("user_id", id)
        .order("date", { ascending: true });

      if (error) console.error("Error fetching rides:", error);
      else setRides(data);
    };

    fetchProfile();
    fetchRides();
  }, [id]);

  const handleStartChat = async (ridePosterId, rideId) => {
    if (!user) return navigate("/login");

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
      const { data: newChat } = await supabase
        .from("chats")
        .insert([{ user1: userA, user2: userB, ride_id: rideId }])
        .select()
        .single();

      chatId = newChat?.id;
    }

    navigate(`/chat/${chatId}`);
  };

  if (!profileData)
    return <p className="text-center mt-10 text-gray-500">Loading…</p>;

  const parsedInterests = profileData.interests
    ? Array.isArray(profileData.interests)
      ? profileData.interests
      : profileData.interests.split(",").map((i) => i.trim())
    : [];

  const today = new Date().toISOString().split("T")[0];
  const activeRides = rides.filter((r) => r.date >= today);
  const pastRides = rides.filter((r) => r.date < today);

  return (
    <div className="max-w-4xl mx-auto px-5 py-12">
      {/* TOP SECTION */}
      <div className="flex flex-col md:flex-row md:items-center gap-8 pb-10 border-b border-gray-200">
        <div
          className="relative cursor-pointer group"
          onClick={() => setShowImage(true)}
        >
          <Avatar
            src={profileData.avatar_url}
            name={profileData.nickname}
            alt="User avatar"
            className="w-32 h-32 rounded-full shadow-md transition group-hover:opacity-90"
          />

          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition">
            View
          </span>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-semibold text-gray-900">
              {profileData.nickname}
            </h1>
          </div>

          <p className="text-gray-500 mt-1">
            {profileData.bio || "This user has not added a bio yet."}
          </p>

          {/* Future: ratings */}
          <div className="mt-2 flex items-center gap-1">
            <span className="text-yellow-400 text-xl">★</span>
            <span className="text-yellow-400 text-xl">★</span>
            <span className="text-yellow-400 text-xl">★</span>
            <span className="text-gray-300 text-xl">★</span>
            <span className="text-gray-300 text-xl">★</span>

            <span className="text-sm text-gray-500 ml-2">(Coming soon)</span>
          </div>

          {/* Message button */}
          {user && user.id !== profileData.id && (
            <button
              onClick={() => handleStartChat(profileData.id, null)}
              className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition"
            >
              Send Message
            </button>
          )}
        </div>
      </div>

      {/* ABOUT CARD */}
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4">About</h2>

          <p className="text-gray-700">
            <strong className="text-gray-900">Name:</strong>{" "}
            {profileData.name || "Not provided"}
          </p>

          <p className="text-gray-700">
            <strong className="text-gray-900">Age:</strong>{" "}
            {profileData.age || "Not provided"}
          </p>

          <p className="text-gray-700 mt-2">
            <strong className="text-gray-900">Interests:</strong>{" "}
            {parsedInterests.length
              ? parsedInterests.join(", ")
              : "No interests listed"}
          </p>
        </div>
      </div>

      {/* ACTIVE RIDES */}
      <section className="mt-14">
        <h2 className="text-2xl font-semibold text-gray-900">Active Rides</h2>

        {activeRides.length ? (
          <ul className="mt-4 space-y-5">
            {activeRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={{ ...ride, profiles: profileData }}
                user={user}
                showAvatar={true}
                showBookNow={user && user.id !== profileData.id}
                onStartChat={handleStartChat}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-gray-500">No active rides.</p>
        )}
      </section>

      {/* PAST RIDES */}
      <section className="mt-14 pb-16">
        <h2 className="text-2xl font-semibold text-gray-900">Past Rides</h2>

        {pastRides.length ? (
          <ul className="mt-4 space-y-5">
            {pastRides.map((ride) => (
              <RideCard
                key={ride.id}
                ride={{ ...ride, profiles: profileData }}
                user={user}
                showAvatar={false}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-gray-500">No past rides.</p>
        )}
      </section>
      {showImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setShowImage(false)}
        >
          <img
            src={profileData.avatar_url}
            alt="Profile large"
            className="max-w-[90%] max-h-[90%] rounded-xl shadow-2xl animate-zoomIn"
          />
        </div>
      )}
    </div>
  );
}
