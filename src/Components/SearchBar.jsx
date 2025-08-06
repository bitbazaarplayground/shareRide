import React, { useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useTranslation } from "react-i18next";
import { FaArrowRight, FaCalendarAlt, FaMapMarkerAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import "../GlobalStyles/globalDatePicker.css";
import { supabase } from "../supabaseClient";
import AutocompleteInput from "./AutocompleteInput";
import PassengerCounter from "./PassengerCounter";
import "./Styles/SearchBar.css";

export default function SearchBar({
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
    <div className="searchbar-container glass">
      <div className="searchbar-item">
        <FaMapMarkerAlt className="icon" />
        <AutocompleteInput
          placeholder={t("From")}
          onPlaceSelected={(place) => setFromPlace(place.formatted_address)}
        />
      </div>

      <div className="searchbar-item">
        <FaArrowRight className="icon" />
        <AutocompleteInput
          placeholder={t("To")}
          onPlaceSelected={(place) => setToPlace(place.formatted_address)}
        />
      </div>

      <div className="searchbar-item">
        <FaCalendarAlt className="icon" />
        <DatePicker
          selected={new Date(selectedDate)}
          onChange={(date) => setSelectedDate(date.toISOString().split("T")[0])}
          minDate={new Date()} // 🔒 Prevent past dates
          dateFormat="dd/MM/yyyy"
          placeholderText="Select a date"
          className="custom-datepicker"
        />
      </div>

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

      <button className="searchbar-button" onClick={handleSearch}>
        {t("Search")}
      </button>
    </div>
  );
}
