import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import AutocompleteInput from "./AutocompleteInput";
import LanguageSwitcher from "./LanguageSwitcher";
import PassengerCounter from "./PassengerCounter";
import "./Styles/Navbar.css";

export default function Navbar() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const [today] = useState(() => new Date().toISOString().split("T")[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);

  const navigate = useNavigate();

  const handleSearch = async () => {
    const { data, error } = await supabase
      .from("rides")
      .select("*")
      .ilike("from", `%${fromPlace}%`)
      .ilike("to", `%${toPlace}%`)
      .eq("date", selectedDate);

    if (error) {
      console.error("Error fetching rides:", error);
    } else {
      navigate("/results", { state: { rides: data } });
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);

  // Handle user logout
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error.message);
    } else {
      // Optionally clear user in your auth context if applicable
      // e.g., setUser(null);

      // Redirect to home or login page after logout
      window.location.href = "/login";
    }
  };
  return (
    <nav className="navbar">
      <div className="navbar-left">
        <h1 className="brand">{t("brand")}</h1>
      </div>

      <div className="navbar-center">
        <AutocompleteInput
          placeholder={t("from")}
          onPlaceSelected={(place) => setFromPlace(place.formatted_address)}
        />
        <AutocompleteInput
          placeholder={t("to")}
          onPlaceSelected={(place) => setToPlace(place.formatted_address)}
        />
        <input
          type="date"
          className="search-input"
          min={today}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          aria-label="Select date"
        />
        <PassengerCounter t={t} />
        <button
          className="search-button"
          onClick={handleSearch}
          aria-label="Search"
        >
          {t("search")}
        </button>
      </div>

      <div className="navbar-right">
        <LanguageSwitcher />
        <button className="publish-button">{t("publishJourney")}</button>

        <div className="login-dropdown" ref={dropdownRef}>
          <button
            className="login-btn"
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen((prev) => !prev)}
          >
            ☰
          </button>

          {dropdownOpen && (
            <div className="dropdown-content">
              {!user ? (
                <>
                  <Link to="/login" onClick={() => setDropdownOpen(false)}>
                    {t("login")}
                  </Link>
                  <Link to="/register" onClick={() => setDropdownOpen(false)}>
                    {t("register")}
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/profile" onClick={() => setDropdownOpen(false)}>
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setDropdownOpen(false);
                    }}
                    className="logout-btn"
                  >
                    Log Out
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
