import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AutocompleteInput from "../Components/AutocompleteInput"; // ✅ Updated to use new <place-autocomplete> component
import "../Components/Styles/PublishRide.css";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";

export default function PublishRide() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];

  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("12:00");
  const [seats, setSeats] = useState(1);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Check if user profile has nickname
  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        alert("You must be logged in to publish a ride.");
        navigate("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", authUser.id)
        .single();

      if (!profile?.nickname) {
        alert("Please complete your profile before publishing a ride.");
        navigate("/complete-profile");
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!fromPlace || !toPlace) {
      setMessage("Please select both From and To addresses.");
      return;
    }

    if (!user) {
      setMessage("You must be logged in to publish a ride.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("rides")
      .insert([
        {
          from: fromPlace,
          to: toPlace,
          date,
          time,
          seats,
          notes,
          user_id: user.id,
          status: "active",
        },
      ])
      .select();

    setLoading(false);

    if (error) {
      setMessage("Error publishing ride.");
      console.error("Supabase insert error:", error);
    } else {
      setMessage("✅ Ride published successfully!");
      setTimeout(() => {
        navigate("/all-rides", {
          state: { rides: data, message: "✅ Ride published successfully!" },
        });
      }, 1500);
    }
  };

  return (
    <div className="publish-container">
      <h2>Publish Your Ride</h2>
      <form onSubmit={handleSubmit}>
        <AutocompleteInput
          placeholder="From"
          onPlaceSelected={(place) => setFromPlace(place.formatted_address)} // ✅ Updated: receives full place object, stores address
        />
        <AutocompleteInput
          placeholder="To"
          onPlaceSelected={(place) => setToPlace(place.formatted_address)} // ✅ Updated: same here for destination
        />
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Seats"
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          min={1}
          required
        />
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Publishing..." : "Publish"}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
