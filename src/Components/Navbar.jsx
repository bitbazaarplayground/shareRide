import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { VscChevronDown } from "react-icons/vsc";
import { Link } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import LanguageSwitcher from "./LanguageSwitcher";
import "./Styles/Navbar.css";

export default function Navbar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) window.location.href = "/login";
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
      {/* Group brand + center nav */}
      <div className="navbar-left-group">
        <div className="navbar-left">
          <h1 className="brand">GoDutch</h1>
        </div>
        <div className="navbar-center">
          <Link to="/ride">Ride</Link>
          <Link to="/ourmission">Our Mission</Link>
          <div className="about-dropdown" ref={dropdownRef}>
            <button
              className={`about-btn ${dropdownOpen ? "open" : ""}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
            >
              About <VscChevronDown className="arrow" />
            </button>

            {dropdownOpen && (
              <div className="about-dropdown-content">
                <Link to="/about-us">About Us</Link>
                <Link to="/careers">Careers</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right section stays the same */}
      <div className="navbar-right">
        <LanguageSwitcher />
        <Link to="/help" className="help-link">
          Help
        </Link>
        {!user ? (
          <>
            <Link to="/login" className="btn black">
              Log in
            </Link>
            <Link to="/register" className="btn white">
              Sign up
            </Link>
          </>
        ) : (
          <>
            <Link to="/profile" className="btn black">
              Profile
            </Link>
            <button className="btn white" onClick={handleLogout}>
              Log out
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
