import React, { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useNavigate } from "react-router-dom";
import AutocompleteInput from "../Components/AutocompleteInput";
import "../Components/Styles/PublishRide.css";
import { useAuth } from "../Contexts/AuthContext";
import "../GlobalStyles/globalDatePicker.css";
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
  const [date, setDate] = useState(new Date());

  const [time, setTime] = useState("12:00");

  // ✅ New state
  const [seatsReserved, setSeatsReserved] = useState(1);
  const [backpacks, setBackpacks] = useState(0);
  const [smallSuitcases, setSmallSuitcases] = useState(0);
  const [largeSuitcases, setLargeSuitcases] = useState(0);

  const [seatLimit, setSeatLimit] = useState(4);
  const [vehicleType, setVehicleType] = useState("regular");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLuggage, setShowLuggage] = useState(false);

  // ✅ Max limits based on vehicle type
  function getMaxByVehicle(type) {
    switch (type) {
      case "van":
        return { seat: 6, backpack: 6, small: 4, large: 4 };
      case "minibus":
        return { seat: 8, backpack: 8, small: 6, large: 6 };
      default:
        return { seat: 4, backpack: 3, small: 2, large: 2 };
    }
  }

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

      const { data: profile } = await supabase
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

    const limits = getMaxByVehicle(vehicleType);

    if (seatsReserved > limits.seat) {
      setMessage(`❌ Max ${limits.seat} passengers allowed for this vehicle.`);
      return;
    }

    if (
      backpacks > limits.backpack ||
      smallSuitcases > limits.small ||
      largeSuitcases > limits.large
    ) {
      setMessage("❌ Luggage exceeds vehicle limit.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("rides")
      .insert([
        {
          from: fromPlace,
          to: toPlace,
          date: date.toISOString().split("T")[0],
          time,
          seats: seatsReserved,
          notes,
          vehicle_type: vehicleType,
          seat_limit: limits.seat,
          luggage_limit: limits.large,
          backpack_count: backpacks,
          small_suitcase_count: smallSuitcases,
          large_suitcase_count: largeSuitcases,
          user_id: user.id,
          status: "active",
        },
      ])
      .select();

    setLoading(false);

    if (error) {
      setMessage("❌ Error publishing ride.");
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

  const limits = getMaxByVehicle(vehicleType);

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

        <DatePicker
          selected={date}
          minDate={new Date()}
          onChange={(date) => setDate(date)}
          dateFormat="dd/MM/yyyy"
          placeholderText="Select a date"
          className="custom-datepicker"
          calendarClassName="global-datepicker"
        />

        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />

        <label>
          How many passengers are traveling with you?{" "}
          <em>(including yourself)</em>
        </label>
        <input
          type="number"
          value={seatsReserved}
          onChange={(e) => setSeatsReserved(Number(e.target.value))}
          min={1}
          max={limits.seat}
        />

        <label>Are you carrying any luggage?</label>
        <select
          value={showLuggage ? "yes" : "no"}
          onChange={(e) => setShowLuggage(e.target.value === "yes")}
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>

        {showLuggage && (
          <>
            <label>How many backpacks?</label>
            <input
              type="number"
              value={backpacks}
              onChange={(e) => setBackpacks(Number(e.target.value))}
              min={0}
              max={limits.backpack}
            />

            <label>How many small suitcases?</label>
            <input
              type="number"
              value={smallSuitcases}
              onChange={(e) => setSmallSuitcases(Number(e.target.value))}
              min={0}
              max={limits.small}
            />

            <label>How many large suitcases?</label>
            <input
              type="number"
              value={largeSuitcases}
              onChange={(e) => setLargeSuitcases(Number(e.target.value))}
              min={0}
              max={limits.large}
            />
          </>
        )}

        <label htmlFor="vehicleType">Vehicle Type</label>
        <select
          id="vehicleType"
          value={vehicleType}
          onChange={(e) => {
            setVehicleType(e.target.value);
            const max = getMaxByVehicle(e.target.value);
            setSeatLimit(max.seat);
          }}
        >
          <option value="regular">Regular Taxi (4 seats, 2 large bags)</option>
          <option value="van">Van (6 seats, 4 large bags)</option>
          <option value="minibus">Minibus (8 seats, 6 large bags)</option>
        </select>

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
