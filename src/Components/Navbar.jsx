import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { VscChevronDown, VscComment } from "react-icons/vsc";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import LanguageSwitcher from "./LanguageSwitcher";
import "./Styles/Navbar.css";

export default function Navbar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) navigate("/");
    else console.error("Logout failed:", error.message);
  };

  // 📩 Fetch unseen message count
  useEffect(() => {
    if (!user) return;

    const fetchUnread = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id", { count: "exact" })
        .eq("recipient_id", user.id)
        .eq("seen", false);

      if (!error) {
        setUnreadCount(data.length);
      }
    };

    fetchUnread();

    const channel = supabase
      .channel("message-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Close dropdown when clicking outside
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
      {/* Left and Center */}
      <div className="navbar-left-group">
        <div className="navbar-left">
          <Link to="/" className="brand">
            GoDutch
          </Link>
        </div>
        <div className="navbar-center">
          <Link to="/publishride">Publish Ride</Link>
          <Link to="/all-rides">View All Rides</Link>
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
                <Link to="/Termsofuse">Term of use</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side */}
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
            <Link
              to="/messages"
              className={`btn icon-btn ${unreadCount > 0 ? "highlight" : ""}`}
              title="Messages"
            >
              <VscComment size={22} />
              {unreadCount > 0 && (
                <span className="notif-bubble">{unreadCount}</span>
              )}
            </Link>
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
