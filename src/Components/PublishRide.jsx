// src/Pages/PublishRide.jsx
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { getGeocode, getLatLng } from "use-places-autocomplete";
import { getVehicleCapacity } from "../../backend/helpers/capacity";
import AutocompleteInput from "../Components/AutocompleteInput";
import "../Components/Styles/PublishRide.css";
import { useAuth } from "../Contexts/AuthContext";
import "../GlobalStyles/globalDatePicker.css";
import { supabase } from "../supabaseClient";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";

const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;
const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN;

export default function PublishRide() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // addresses + coords
  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [fromCoords, setFromCoords] = useState(null);
  const [toCoords, setToCoords] = useState(null);

  // fare estimate (very rough)
  const [estimate, setEstimate] = useState(null);

  // date/time
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState("12:00");

  // passengers + luggage
  const [seatsReserved, setSeatsReserved] = useState(1);
  const [backpacks, setBackpacks] = useState(0);
  const [smallSuitcases, setSmallSuitcases] = useState(0);
  const [largeSuitcases, setLargeSuitcases] = useState(0);

  // vehicle, notes, UI
  const [vehicleType, setVehicleType] = useState("regular");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLuggage, setShowLuggage] = useState(false);

  // require login + completed profile
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        alert("You must be logged in to publish a ride.");
        navigate("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", auth.user.id)
        .single();
      if (!profile?.nickname) {
        alert("Please complete your profile before publishing a ride.");
        navigate("/complete-profile");
      }
    })();
  }, [navigate]);

  // simple haversine estimate (UX only)
  useEffect(() => {
    if (!fromCoords || !toCoords) {
      setEstimate(null);
      return;
    }
    const R = 6371; // km
    const dLat = ((toCoords.lat - fromCoords.lat) * Math.PI) / 180;
    const dLng = ((toCoords.lng - fromCoords.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((fromCoords.lat * Math.PI) / 180) *
        Math.cos((toCoords.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    const price = (2.5 + distance * 1.8).toFixed(2);
    setEstimate(price);
  }, [fromCoords, toCoords]);

  // normalize date (avoid timezone off-by-one)
  const toLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // geocode fallback if user typed raw text
  async function geocodeAddress(address) {
    try {
      await loadGoogleMaps({
        apiKey: import.meta.env.VITE_MAPS_KEY,
        libraries: ["places"],
        v: "weekly",
      });
      const results = await getGeocode({ address });
      if (!results?.length) return null;
      const { lat, lng } = await getLatLng(results[0]);
      return { lat, lng };
    } catch (e) {
      console.error("Geocode failed:", e);
      return null;
    }
  }

  useEffect(() => {
    loadGoogleMaps({
      apiKey: import.meta.env.VITE_MAPS_KEY,
      libraries: ["places"],
      v: "weekly",
    }).catch((e) => console.error("Maps loader error:", e));
  }, []);

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

    const limits = getVehicleCapacity(vehicleType);

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
    const origin =
      fromCoords ?? (fromPlace ? await geocodeAddress(fromPlace) : null);
    const dest = toCoords ?? (toPlace ? await geocodeAddress(toPlace) : null);

    const payload = {
      from: fromPlace,
      to: toPlace,
      date: toLocalYMD(date),
      time,
      seats: seatsReserved,
      notes,
      vehicle_type: vehicleType,
      seat_limit: limits.seat,
      luggage_limit: limits.backpack + limits.small + limits.large,
      backpack_count: backpacks || 0,
      small_suitcase_count: smallSuitcases || 0,
      large_suitcase_count: largeSuitcases || 0,
      user_id: user.id,
      status: "active",
      estimated_fare: estimate ? Number(estimate) : null,
      from_lat: origin?.lat ?? null,
      from_lng: origin?.lng ?? null,
      to_lat: dest?.lat ?? null,
      to_lng: dest?.lng ?? null,
    };

    try {
      // 1. Insert ride
      const { data, error } = await supabase
        .from("rides")
        .insert([payload])
        .select("id")
        .single();

      if (error) throw error;

      const rideId = data.id;

      setMessage("✅ Ride published successfully!");
      setTimeout(() => {
        navigate("/all-rides", {
          state: { rides: [data], message: "✅ Ride published successfully!" },
        });
      }, 1000);
    } catch (err) {
      console.error("Supabase insert error:", err);
      setMessage("❌ Error publishing ride.");
    } finally {
      setLoading(false);
    }
  };

  const limits = getVehicleCapacity(vehicleType);

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Publish a Ride — TabFair",
    description:
      "Offer a ride, set your pickup and drop-off, and share the cost with trusted passengers.",
    url: `${APP_ORIGIN}/publishride`,
  };

  return (
    <div className="publish-container">
      <Helmet>
        <title>Publish a Ride — TabFair</title>
        <meta
          name="description"
          content="Offer a ride, set your pickup and drop-off, and share the cost with trusted passengers."
        />
        <link rel="canonical" href={`${APP_ORIGIN}/publishride`} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TabFair" />
        <meta property="og:title" content="Publish a Ride — TabFair" />
        <meta
          property="og:description"
          content="Offer a ride, set your pickup and drop-off, and share the cost with trusted passengers."
        />
        <meta property="og:url" content={`${APP_ORIGIN}/publishride`} />
        <meta property="og:image" content={`${APP_ORIGIN}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Publish a Ride — TabFair" />
        <meta
          name="twitter:description"
          content="Offer a ride, set your pickup and drop-off, and share the cost with trusted passengers."
        />
        <meta name="twitter:image" content={`${APP_ORIGIN}/og-image.jpg`} />

        {/* JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify(webPageJsonLd)}
        </script>
      </Helmet>

      <h2>Publish Your Ride</h2>

      <form onSubmit={handleSubmit}>
        {/* From */}
        <label className="sr-only" htmlFor="from">
          From
        </label>
        <AutocompleteInput
          id="from"
          name="from"
          placeholder="From"
          onPlaceSelected={({ formatted_address, lat, lng }) => {
            setFromPlace(formatted_address);
            setFromCoords({ lat, lng });
          }}
        />

        {/* To */}
        <label className="sr-only" htmlFor="to">
          To
        </label>
        <AutocompleteInput
          id="to"
          name="to"
          placeholder="To"
          onPlaceSelected={({ formatted_address, lat, lng }) => {
            setToPlace(formatted_address);
            setToCoords({ lat, lng });
          }}
        />

        {estimate && <p>Estimated Taxi Cost: £{estimate}</p>}

        {/* Date + Time */}
        <DatePicker
          selected={date}
          minDate={new Date()}
          onChange={(d) => d && setDate(d)}
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
          aria-label="Departure time"
        />

        {/* Passengers */}
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

        {/* Luggage */}
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

        {/* Vehicle */}
        <label htmlFor="vehicleType">Vehicle Type</label>
        <select
          id="vehicleType"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
        >
          <option value="regular">Regular Taxi (4 seats, 2 large bags)</option>
          <option value="van">Van (6 seats, 4 large bags)</option>
          <option value="minibus">Minibus (8 seats, 6 large bags)</option>
        </select>

        {/* Notes */}
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Submit */}
        <button type="submit" disabled={loading}>
          {loading ? "Publishing..." : "Publish"}
        </button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}
