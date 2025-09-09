// src/Pages/PublishRide.jsx
import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { getGeocode, getLatLng } from "use-places-autocomplete";
import AutocompleteInput from "../Components/AutocompleteInput";
import "../Components/Styles/PublishRide.css";
import { useAuth } from "../Contexts/AuthContext";
import "../GlobalStyles/globalDatePicker.css";
import { supabase } from "../supabaseClient";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";

export default function PublishRide() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // addresses + coords
  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [fromCoords, setFromCoords] = useState(null); // { lat, lng } | null
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

  function getMaxByVehicle(type) {
    switch (type) {
      case "van":
        return { seat: 6, backpack: 6, small: 4, large: 4 };
      case "minibus":
        return { seat: 8, backpack: 8, small: 6, large: 6 };
      default:
        return { seat: 4, backpack: 4, small: 2, large: 2 };
    }
  }

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

  // normalize date (avoid timezone off‑by‑one)
  const toLocalYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // geocode fallback if user typed raw text
  async function geocodeAddress(address) {
    try {
      // Ensure Maps JS (Places, since the page uses Autocomplete) is ready
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

  // (optional but nice) kick off loading on mount so it’s ready by the time the user types
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
    //Test
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
      luggage_limit: limits.large,
      backpack_count: showLuggage ? backpacks : limits.backpack,
      small_suitcase_count: showLuggage ? smallSuitcases : limits.small,
      large_suitcase_count: showLuggage ? largeSuitcases : limits.large,
      user_id: user.id,
      status: "active",
      estimated_fare: estimate ? Number(estimate) : null,
      // coordinates
      from_lat: origin?.lat ?? null,
      from_lng: origin?.lng ?? null,
      to_lat: dest?.lat ?? null,
      to_lng: dest?.lng ?? null,
    };

    try {
      const { data, error } = await supabase
        .from("rides")
        .insert([payload])
        .select();

      if (error) throw error;

      setMessage("✅ Ride published successfully!");
      setTimeout(() => {
        navigate("/all-rides", {
          state: { rides: data, message: "✅ Ride published successfully!" },
        });
      }, 1000);
    } catch (err) {
      console.error("Supabase insert error:", err);
      setMessage("❌ Error publishing ride.");
    } finally {
      setLoading(false);
    }
  };

  const limits = getMaxByVehicle(vehicleType);

  // Page JSON-LD (optional but nice)
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Publish a Ride — TabFair",
    description:
      "Offer a ride, set your pickup and drop-off, and share the cost with trusted passengers.",
    url: "https://jade-rolypoly-5d4274.netlify.app/publishride",
  };

  return (
    <div className="publish-container">
      <Helmet>
        <title>Publish a Ride — TabFair</title>
        <meta
          name="description"
          content="Offer a ride, set your pickup and drop-off, and share the cost with trusted passengers."
        />
        <link
          rel="canonical"
          href="https://jade-rolypoly-5d4274.netlify.app/publishride"
        />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TabFair" />
        <meta property="og:title" content="Publish a Ride — TabFair" />
        <meta
          property="og:description"
          content="Offer a ride, set your pickup and drop-off, and share the cost with trusted passengers."
        />
        <meta
          property="og:url"
          content="https://jade-rolypoly-5d4274.netlify.app/publishride"
        />
        <meta
          property="og:image"
          content="https://jade-rolypoly-5d4274.netlify.app/og-image.jpg"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Publish a Ride — TabFair" />
        <meta
          name="twitter:description"
          content="Offer a ride, set your pickup and drop-off, and share the cost with trusted passengers."
        />
        <meta
          name="twitter:image"
          content="https://jade-rolypoly-5d4274.netlify.app/og-image.jpg"
        />

        {/* JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify(webPageJsonLd)}
        </script>
      </Helmet>

      <h2>Publish Your Ride</h2>

      <form onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="from">
          From
        </label>
        <AutocompleteInput
          id="from" // ← connects label ↔ input (a11y)
          name="from"
          placeholder="From"
          // Optional: choose ONE—restrict to UK *or* bias toward UK
          // countries={["gb"]}                             // UK-only
          // bias={{ lat: 54.5, lng: -3.5, radiusMeters: 800_000 }} // UK-biased
          onPlaceSelected={({ formatted_address, lat, lng }) => {
            setFromPlace(formatted_address);
            setFromCoords({ lat, lng });
          }}
        />

        <label className="sr-only" htmlFor="to">
          To
        </label>
        <AutocompleteInput
          id="to"
          name="to"
          placeholder="To"
          // countries={["gb"]}
          // bias={{ lat: 54.5, lng: -3.5, radiusMeters: 800_000 }}
          onPlaceSelected={({ formatted_address, lat, lng }) => {
            setToPlace(formatted_address);
            setToCoords({ lat, lng });
          }}
        />

        {estimate && <p>Estimated Taxi Cost: £{estimate}</p>}

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
          onChange={(e) => setVehicleType(e.target.value)}
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
