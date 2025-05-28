import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import PassengerCounter from "./PassengerCounter";
import "./Styles/Navbar.css";

export default function Navbar() {
  const { t } = useTranslation();
  const [today] = useState(() => new Date().toISOString().split("T")[0]);

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
        <div className="login-dropdown">
          <button className="login-btn">☰</button>
          <div className="dropdown-content">
            <a href="/login">{t("login")}</a>
            <a href="/register">{t("register")}</a>
          </div>
        </div>
      </div>
    </nav>
  );
}
