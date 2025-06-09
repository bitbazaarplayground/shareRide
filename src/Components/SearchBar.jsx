import { collection, getDocs, query, where } from "firebase/firestore";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaCalendarAlt, FaMapMarkerAlt, FaSquare } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import AutocompleteInput from "./AutocompleteInput";
import PassengerCounter from "./PassengerCounter";
import "./Styles/SearchBar.css";

export default function SearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const handleSearch = async () => {
    try {
      const ridesRef = collection(db, "rides");

      const q = query(ridesRef, where("date", "==", selectedDate));

      const querySnapshot = await getDocs(q);

      const matchedRides = querySnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (ride) =>
            ride.from?.toLowerCase().includes(fromPlace.toLowerCase()) &&
            ride.to?.toLowerCase().includes(toPlace.toLowerCase())
        );

      navigate("/results", { state: { rides: matchedRides } });
    } catch (error) {
      console.error("Error fetching rides:", error.message);
    }
  };

  return (
    <div className="search-container">
      <h1 className="heading">{t("Search for rides")}</h1>

      <div className="input-box">
        <FaMapMarkerAlt className="icon start" />
        <AutocompleteInput
          placeholder={t("from")}
          onPlaceSelected={(place) => setFromPlace(place.formatted_address)}
        />
      </div>

      <div className="input-box">
        <FaSquare className="icon start" />
        <AutocompleteInput
          placeholder={t("to")}
          onPlaceSelected={(place) => setToPlace(place.formatted_address)}
        />
      </div>

      <div className="date-time">
        <div className="pill">
          <FaCalendarAlt className="icon" />
          <input
            type="date"
            min={new Date().toISOString().split("T")[0]}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
            aria-label="Select date"
          />
        </div>
        <PassengerCounter t={t} />
      </div>

      <button className="search-btn" onClick={handleSearch}>
        {t("search")}
      </button>
      <div className="login-hint">{t("login_to_see_recent_activity")}</div>
    </div>
  );
}
