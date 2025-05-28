import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import LanguageSwitcher from "./LanguageSwitcher";
import PassengerCounter from "./PassengerCounter";
import "./Styles/Navbar.css";

export default function Navbar() {
  const { t } = useTranslation();
  const [today] = useState(() => new Date().toISOString().split("T")[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <h1 className="brand">{t("brand")}</h1>
      </div>

      <div className="navbar-center">
        <input type="text" className="search-input" placeholder={t("from")} />
        <input type="text" className="search-input" placeholder={t("to")} />
        <input
          type="date"
          className="search-input"
          min={today}
          defaultValue={today}
          aria-label="Select date"
        />
        <PassengerCounter t={t} />
        <button className="search-button" aria-label="Search">
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
              <Link to="/login" onClick={() => setDropdownOpen(false)}>
                {t("login")}
              </Link>
              <Link to="/register" onClick={() => setDropdownOpen(false)}>
                {t("register")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
