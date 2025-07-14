import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FaCalendarAlt,
  FaClock,
  FaMapMarkerAlt,
  FaSquare,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import AutocompleteInput from "./AutocompleteInput";
import PassengerCounter from "./PassengerCounter";
import "./Styles/SearchBar.css";

export default function SearchBar({
  variant = "vertical",
  passengerCount,
  setPassengerCount,
  backpacks,
  setBackpacks,
  smallSuitcases,
  setSmallSuitcases,
  largeSuitcases,
  setLargeSuitcases,
}) {
  const { t } = useTranslation();
  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectedTime, setSelectedTime] = useState("");
  const navigate = useNavigate();

  const handleSearch = async () => {
    const { data, error } = await supabase
      .from("rides")
      .select("*, profiles(id, nickname, avatar_url)")
      .ilike("from", `%${fromPlace}%`)
      .ilike("to", `%${toPlace}%`)
      .eq("date", selectedDate);

    if (error) console.error("Error fetching rides:", error);
    else navigate("/results", { state: { rides: data } });
  };

  return (
    <div className={`search-container ${variant}`}>
      {variant === "vertical" && (
        <>
          <h1 className="heading">{t("Search for rides")}</h1>

          <div className={`input-box ${variant}`}>
            <FaMapMarkerAlt className="icon" />
            <AutocompleteInput
              placeholder={t("from")}
              onPlaceSelected={(place) => setFromPlace(place.formatted_address)}
            />
          </div>

          <div className={`input-box ${variant}`}>
            <FaSquare className="icon" />
            <AutocompleteInput
              placeholder={t("to")}
              onPlaceSelected={(place) => setToPlace(place.formatted_address)}
            />
          </div>

          <div className={`date-time ${variant}`}>
            <div className="pill vertical">
              <FaCalendarAlt className="icon" />
              <input
                type="date"
                min={selectedDate}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`date-input ${variant}`}
                aria-label="Select date"
              />
            </div>
            <PassengerCounter
              t={t}
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

          <button className={`search-btn ${variant}`} onClick={handleSearch}>
            {t("search")}
          </button>

          <div className="login-hint">{t("login_to_see_recent_activity")}</div>
        </>
      )}

      {variant === "horizontal" && (
        <>
          <div className="row top-row">
            <div className={`input-box ${variant}`}>
              <FaMapMarkerAlt className="icon" />
              <AutocompleteInput
                placeholder={t("from")}
                onPlaceSelected={(place) =>
                  setFromPlace(place.formatted_address)
                }
              />
            </div>

            <div className={`input-box ${variant}`}>
              <FaSquare className="icon" />
              <AutocompleteInput
                placeholder={t("to")}
                onPlaceSelected={(place) => setToPlace(place.formatted_address)}
              />
            </div>

            <div className={`pill ${variant}`}>
              <FaCalendarAlt className="icon" />
              <input
                type="date"
                min={selectedDate}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className={`date-input ${variant}`}
                aria-label="Select date"
              />
            </div>

            <div className={`pill ${variant}`}>
              <FaClock className="icon" />
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className={`time-input ${variant}`}
                aria-label="Select time"
              />
            </div>
          </div>

          <div className="row bottom-row">
            <PassengerCounter
              t={t}
              passengerCount={passengerCount}
              setPassengerCount={setPassengerCount}
              backpacks={backpacks}
              setBackpacks={setBackpacks}
              smallSuitcases={smallSuitcases}
              setSmallSuitcases={setSmallSuitcases}
              largeSuitcases={largeSuitcases}
              setLargeSuitcases={setLargeSuitcases}
            />

            <button className={`search-btn ${variant}`} onClick={handleSearch}>
              {t("search")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
