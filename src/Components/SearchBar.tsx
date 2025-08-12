// src/Components/SearchBar.tsx
import { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useTranslation } from "react-i18next";
import { FaArrowRight, FaCalendarAlt, FaMapMarkerAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "../GlobalStyles/globalDatePicker.css";
import { supabase } from "../supabaseClient";
import AutocompleteInput, { SelectedPlace } from "./AutocompleteInput";
import PassengerCounter from "./PassengerCounter";
import "./Styles/SearchBar.css";

interface SearchBarProps {
  passengerCount: number;
  setPassengerCount: (n: number) => void;
  backpacks: number;
  setBackpacks: (n: number) => void;
  smallSuitcases: number;
  setSmallSuitcases: (n: number) => void;
  largeSuitcases: number;
  setLargeSuitcases: (n: number) => void;
}

export default function SearchBar({
  passengerCount,
  setPassengerCount,
  backpacks,
  setBackpacks,
  smallSuitcases,
  setSmallSuitcases,
  largeSuitcases,
  setLargeSuitcases,
}: SearchBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Address + coordinates
  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [fromCoords, setFromCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const [fromSelected, setFromSelected] = useState(false);
  const [toSelected, setToSelected] = useState(false);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Radius selector (meters). Converted to km for the RPC.
  const radiusOptionsM = [1, 5, 10, 25, 50, 100, 250, 500];
  const [radiusMeters, setRadiusMeters] = useState<number>(500);

  const onFromSelected = (place: SelectedPlace) => {
    setFromSelected(true);
    setFromPlace(place.formatted_address);
    setFromCoords({ lat: place.lat, lng: place.lng });
  };

  const onToSelected = (place: SelectedPlace) => {
    setToSelected(true);
    setToPlace(place.formatted_address);
    setToCoords({ lat: place.lat, lng: place.lng });
  };

  // Minimal, conservative capacity filter using seat_limit if present
  const applyCapacityFilter = (rides: any[]) => {
    if (!rides?.length) return rides;
    const filtered = rides.filter((r) => {
      // If seat_limit exists, require it to meet passengerCount
      if (typeof r.seat_limit === "number" && r.seat_limit < passengerCount)
        return false;
      return true;
    });
    return filtered;
  };

  const enrichWithProfiles = async (ids: string[]) => {
    const { data: joined, error: joinErr } = await supabase
      .from("rides")
      .select("*, profiles(id, nickname, avatar_url)")
      .in("id", ids);
    if (joinErr) {
      console.warn("Profiles join failed; falling back to raw rides.", joinErr);
      return null;
    }
    return joined ?? null;
  };

  const handleSearch = async () => {
    let hits: any[] = [];

    // If both coords present → use RPC; otherwise fallback to ilike text search
    if (fromCoords && toCoords) {
      const radius_km = radiusMeters / 1000;
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "search_rides_by_route",
        {
          origin_lat: fromCoords.lat,
          origin_lng: fromCoords.lng,
          dest_lat: toCoords.lat,
          dest_lng: toCoords.lng,
          radius_km,
          ride_date: selectedDate,
        }
      );
      if (rpcError) {
        console.error("RPC search_rides_by_route error:", rpcError);
        alert("Search failed. Please try again.");
        return;
      }
      hits = rpcData || [];
    } else {
      // Text fallback so the button works in View All Rides even if user didn't pick from dropdown
      const { data, error } = await supabase
        .from("rides")
        .select("*, profiles(id, nickname, avatar_url)")
        .ilike("from", `%${fromPlace}%`)
        .ilike("to", `%${toPlace}%`)
        .eq("date", selectedDate)
        .eq("status", "active");
      if (error) {
        console.error("Text search error:", error);
        alert("Search failed. Please try again.");
        return;
      }
      hits = data || [];
    }

    // Capacity filter (seats only, conservative)
    let filtered = applyCapacityFilter(hits);

    // Enrich RPC results with profiles to keep RideCard happy
    if (fromCoords && toCoords && filtered.length > 0) {
      const ids = filtered.map((r) => r.id);
      const joined = await enrichWithProfiles(ids);
      if (joined) filtered = joined;
    }

    // No results → ask to post a ride, stay if they choose No
    if (!filtered || filtered.length === 0) {
      const goPost = window.confirm(
        "No rides are available for your search. Would you like to post a ride?"
      );
      if (goPost) navigate("/publishride");
      return; // stay on /all-rides if they choose No
    }

    // Results → navigate to /results (existing pattern)
    navigate("/results", {
      state: {
        rides: filtered,
        fromCoords,
        toCoords,
        radiusKm: radiusMeters / 1000,
        // pass search params if Results page wants to display them later
        params: {
          from: fromPlace,
          to: toPlace,
          date: selectedDate,
          passengers: passengerCount,
          backpacks,
          smallSuitcases,
          largeSuitcases,
        },
      },
    });
  };

  return (
    <div className="searchbar-container glass">
      {/* FROM */}
      <div className="searchbar-item">
        {!fromSelected && (
          <FaMapMarkerAlt className="icon" aria-hidden="true" />
        )}
        <AutocompleteInput
          placeholder={t("From")}
          onPlaceSelected={onFromSelected}
        />
      </div>

      {/* TO */}
      <div className="searchbar-item">
        {!toSelected && <FaArrowRight className="icon" aria-hidden="true" />}
        <AutocompleteInput
          placeholder={t("To")}
          onPlaceSelected={onToSelected}
        />
      </div>

      {/* DATE */}
      <div className="searchbar-item">
        <FaCalendarAlt className="icon" aria-hidden="true" />
        <DatePicker
          selected={new Date(selectedDate)}
          onChange={(date: Date | null) => {
            if (date) setSelectedDate(date.toISOString().split("T")[0]);
          }}
          minDate={new Date()} // prevent past dates
          dateFormat="dd/MM/yyyy"
          placeholderText="Select a date"
          className="custom-datepicker"
          calendarClassName="global-datepicker"
        />
      </div>

      {/* RADIUS (meters) */}
      <div className="searchbar-item radius-item">
        <label htmlFor="radius" className="visually-hidden">
          Search radius (meters)
        </label>
        <select
          id="radius"
          value={radiusMeters}
          onChange={(e) => setRadiusMeters(Number(e.target.value))}
          className="radius-select"
          aria-label="Search radius in meters"
        >
          {[1, 5, 10, 25, 50, 100, 250, 500].map((m) => (
            <option key={m} value={m}>
              {m} m
            </option>
          ))}
        </select>
      </div>

      {/* PASSENGERS + LUGGAGE */}
      <div className="passenger-item">
        <PassengerCounter
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

      {/* SEARCH */}
      <button className="searchbar-button" onClick={handleSearch}>
        {t("Search")}
      </button>
    </div>
  );
}

// // src/Components/SearchBar.tsx
// import { useState } from "react";
// import DatePicker from "react-datepicker";
// import "react-datepicker/dist/react-datepicker.css";
// import { useTranslation } from "react-i18next";
// import { FaArrowRight, FaCalendarAlt, FaMapMarkerAlt } from "react-icons/fa";
// import { useNavigate } from "react-router-dom";
// import "../GlobalStyles/globalDatePicker.css";
// import { supabase } from "../supabaseClient";
// import AutocompleteInput, { SelectedPlace } from "./AutocompleteInput";
// import PassengerCounter from "./PassengerCounter";
// import "./Styles/SearchBar.css";

// interface SearchBarProps {
//   passengerCount: number;
//   setPassengerCount: (n: number) => void;
//   backpacks: number;
//   setBackpacks: (n: number) => void;
//   smallSuitcases: number;
//   setSmallSuitcases: (n: number) => void;
//   largeSuitcases: number;
//   setLargeSuitcases: (n: number) => void;
// }

// export default function SearchBar({
//   passengerCount,
//   setPassengerCount,
//   backpacks,
//   setBackpacks,
//   smallSuitcases,
//   setSmallSuitcases,
//   largeSuitcases,
//   setLargeSuitcases,
// }: SearchBarProps) {
//   const { t } = useTranslation();
//   const navigate = useNavigate();

//   // Address + coordinates
//   const [fromPlace, setFromPlace] = useState("");
//   const [toPlace, setToPlace] = useState("");
//   const [fromCoords, setFromCoords] = useState<{
//     lat: number;
//     lng: number;
//   } | null>(null);
//   const [toCoords, setToCoords] = useState<{ lat: number; lng: number } | null>(
//     null
//   );

//   const [fromSelected, setFromSelected] = useState(false);
//   const [toSelected, setToSelected] = useState(false);

//   const [selectedDate, setSelectedDate] = useState(
//     new Date().toISOString().split("T")[0]
//   );

//   // Radius selector (meters). We convert to km for the RPC.
//   const radiusOptionsM = [1, 5, 10, 25, 50, 100, 250, 500];
//   const [radiusMeters, setRadiusMeters] = useState<number>(500);

//   const onFromSelected = (place: SelectedPlace) => {
//     setFromSelected(true);
//     setFromPlace(place.formatted_address);
//     setFromCoords({ lat: place.lat, lng: place.lng });
//   };

//   const onToSelected = (place: SelectedPlace) => {
//     setToSelected(true);
//     setToPlace(place.formatted_address);
//     setToCoords({ lat: place.lat, lng: place.lng });
//   };

//   const handleSearch = async () => {
//     if (!fromCoords || !toCoords) {
//       alert(
//         "Please choose both From and To from the suggestions so we can match by distance."
//       );
//       return;
//     }

//     const radius_km = radiusMeters / 1000;

//     // 1) Geo search via RPC
//     const { data: hits, error: rpcError } = await supabase.rpc(
//       "search_rides_by_route",
//       {
//         origin_lat: fromCoords.lat,
//         origin_lng: fromCoords.lng,
//         dest_lat: toCoords.lat,
//         dest_lng: toCoords.lng,
//         radius_km,
//         ride_date: selectedDate,
//       }
//     );

//     if (rpcError) {
//       console.error("RPC search_rides_by_route error:", rpcError);
//       alert("Search failed. Please try again.");
//       return;
//     }

//     // 2) Enrich with profiles for RideCard
//     let ridesWithProfiles = hits || [];
//     if (ridesWithProfiles.length > 0) {
//       const ids = ridesWithProfiles.map((r: any) => r.id);
//       const { data: joined, error: joinErr } = await supabase
//         .from("rides")
//         .select("*, profiles(id, nickname, avatar_url)")
//         .in("id", ids);

//       if (!joinErr && joined) {
//         ridesWithProfiles = joined;
//       } else if (joinErr) {
//         console.warn(
//           "Profiles join failed; falling back to raw rides.",
//           joinErr
//         );
//       }
//     }

//     navigate("/results", {
//       state: {
//         rides: ridesWithProfiles,
//         fromCoords,
//         toCoords,
//         radiusKm: radius_km,
//       },
//     });
//   };

//   return (
//     <div className="searchbar-container glass">
//       {/* FROM */}
//       <div className="searchbar-item">
//         {!fromSelected && (
//           <FaMapMarkerAlt className="icon" aria-hidden="true" />
//         )}
//         <AutocompleteInput
//           placeholder={t("From")}
//           onPlaceSelected={onFromSelected}
//         />
//       </div>

//       {/* TO */}
//       <div className="searchbar-item">
//         {!toSelected && <FaArrowRight className="icon" aria-hidden="true" />}
//         <AutocompleteInput
//           placeholder={t("To")}
//           onPlaceSelected={onToSelected}
//         />
//       </div>

//       {/* DATE */}
//       <div className="searchbar-item">
//         <FaCalendarAlt className="icon" aria-hidden="true" />
//         <DatePicker
//           selected={new Date(selectedDate)}
//           onChange={(date: Date | null) => {
//             if (date) setSelectedDate(date.toISOString().split("T")[0]);
//           }}
//           minDate={new Date()} // prevent past dates
//           dateFormat="dd/MM/yyyy"
//           placeholderText="Select a date"
//           className="custom-datepicker"
//           calendarClassName="global-datepicker"
//         />
//       </div>

//       {/* RADIUS (meters) */}
//       <div className="searchbar-item radius-item">
//         <label htmlFor="radius" className="visually-hidden">
//           Search radius (meters)
//         </label>
//         <select
//           id="radius"
//           value={radiusMeters}
//           onChange={(e) => setRadiusMeters(Number(e.target.value))}
//           className="radius-select"
//           aria-label="Search radius in meters"
//         >
//           {radiusOptionsM.map((m) => (
//             <option key={m} value={m}>
//               {m} m
//             </option>
//           ))}
//         </select>
//       </div>

//       {/* PASSENGERS + LUGGAGE */}
//       <div className="passenger-item">
//         <PassengerCounter
//           passengerCount={passengerCount}
//           setPassengerCount={setPassengerCount}
//           backpacks={backpacks}
//           setBackpacks={setBackpacks}
//           smallSuitcases={smallSuitcases}
//           setSmallSuitcases={setSmallSuitcases}
//           largeSuitcases={largeSuitcases}
//           setLargeSuitcases={setLargeSuitcases}
//         />
//       </div>

//       {/* SEARCH */}
//       <button className="searchbar-button" onClick={handleSearch}>
//         {t("Search")}
//       </button>
//     </div>
//   );
// }
