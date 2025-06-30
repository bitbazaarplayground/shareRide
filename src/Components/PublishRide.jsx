import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AutocompleteInput from "../Components/AutocompleteInput";
import "../Components/Styles/PublishRide.css";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";

export default function PublishRide() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];

  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [fromCoords, setFromCoords] = useState(null);
  const [toCoords, setToCoords] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("12:00");
  const [seats, setSeats] = useState(1);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (fromCoords && toCoords) {
      const R = 6371;
      const dLat = ((toCoords.lat - fromCoords.lat) * Math.PI) / 180;
      const dLng = ((toCoords.lng - fromCoords.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((fromCoords.lat * Math.PI) / 180) *
          Math.cos((toCoords.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      const price = (2.5 + distance * 1.8).toFixed(2);
      setEstimate(price);
    }
  }, [fromCoords, toCoords]);

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
          onPlaceSelected={(place) => {
            setFromPlace(place.formatted_address);
            if (place.geometry?.location) {
              setFromCoords({
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              });
            }
          }}
        />
        <AutocompleteInput
          placeholder="To"
          onPlaceSelected={(place) => {
            setToPlace(place.formatted_address);
            if (place.geometry?.location) {
              setToCoords({
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              });
            }
          }}
        />

        {estimate && <p>Estimated Taxi Cost: £{estimate}</p>}

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
