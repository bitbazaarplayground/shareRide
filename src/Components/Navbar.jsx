import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { VscChevronDown } from "react-icons/vsc";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import LanguageSwitcher from "./LanguageSwitcher";
import "./Styles/Navbar.css";

export default function Navbar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState(null);
  const aboutDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) navigate("/");
    else console.error("Logout failed:", error.message);
  };

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

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, nickname, avatar_url")
        .eq("id", user.id)
        .single();

      if (!error) setProfile(data);
    };

    fetchUnread();
    fetchProfile();

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

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        aboutDropdownRef.current &&
        !aboutDropdownRef.current.contains(event.target)
      ) {
        setAboutOpen(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target)
      ) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="navbar">
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
          <div className="about-dropdown" ref={aboutDropdownRef}>
            <button
              className={`about-btn ${aboutOpen ? "open" : ""}`}
              onClick={() => setAboutOpen((prev) => !prev)}
            >
              About <VscChevronDown className="arrow" />
            </button>
            {aboutOpen && (
              <div className="about-dropdown-content">
                <Link to="/about-us">About Us</Link>
                <Link to="/careers">Careers</Link>
                <Link to="/Termsofuse">Term of use</Link>
              </div>
            )}
          </div>
        </div>
      </div>

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
          <div className="user-dropdown" ref={userDropdownRef}>
            <button
              className={`user-btn ${userOpen ? "open" : ""}`}
              onClick={() => setUserOpen((prev) => !prev)}
            >
              {profile?.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt="avatar"
                  className="nav-avatar"
                />
              )}
              {profile?.nickname || profile?.name || user.email.split("@")[0]}{" "}
              <VscChevronDown className="arrow" />
            </button>
            {userOpen && (
              <div className="user-dropdown-content">
                <Link
                  to="/messages"
                  className={unreadCount > 0 ? "highlight" : ""}
                >
                  Messages {unreadCount > 0 && <span>({unreadCount})</span>}
                </Link>
                <Link to="/profile">Profile</Link>
                <Link to="/my-rides">My Rides</Link>
                <button onClick={handleLogout} className="logout-btn">
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
