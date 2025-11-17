// src/Components/Navbar.jsx
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { VscChevronDown } from "react-icons/vsc";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./Styles/Navbar.css";

export default function Navbar({ variant = "transparent" }) {
  const { t } = useTranslation();
  const { user, loading, signOut } = useAuth();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profile, setProfile] = useState(null);

  const aboutDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);
  const navigate = useNavigate();

  // Sign out via context (keeps UI + auth in sync)
  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  // Fetch profile + unread, subscribe to new messages
  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setUnreadCount(0);

    if (!user?.id) return;

    const fetchUnread = async () => {
      // Only count, no rows
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("seen", false);

      if (!cancelled && !error) setUnreadCount(count ?? 0);
    };

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, nickname, avatar_url")
        .eq("id", user.id)
        .single();

      if (!cancelled && !error) setProfile(data);
    };

    fetchUnread();
    fetchProfile();

    // Realtime: increment on new messages for this user
    const channel = supabase
      .channel(`msg-notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          if (!cancelled) setUnreadCount((n) => n + 1);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Close dropdowns on outside click / Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        aboutDropdownRef.current &&
        !aboutDropdownRef.current.contains(e.target)
      ) {
        setAboutOpen(false);
      }
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(e.target)
      ) {
        setUserOpen(false);
      }
    }
    function handleKeydown(e) {
      if (e.key === "Escape") {
        setAboutOpen(false);
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  return (
    <nav className={`navbar ${variant}`}>
      <div className="navbar-left">
        <Link to="/" className="brand" aria-label="TabFair home">
          Tabfair
        </Link>
      </div>

      <div className="navbar-center">
        <Link to="/publishride">{t("Publish Ride") || "Publish Ride"}</Link>
        <Link to="/all-rides">{t("View All Rides") || "View All Rides"}</Link>

        <div className="about-dropdown" ref={aboutDropdownRef}>
          <button
            className={`about-btn ${aboutOpen ? "open" : ""}`}
            onClick={() => setAboutOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={aboutOpen}
            aria-controls="about-menu"
          >
            {t("About") || "About"} <VscChevronDown className="arrow" />
          </button>
          {aboutOpen && (
            <div id="about-menu" role="menu" className="about-dropdown-content">
              <Link role="menuitem" to="/ourmission">
                {t("Our Mission") || "Our Mission"}
              </Link>
              <Link role="menuitem" to="/about-us">
                {t("About Us") || "About Us"}
              </Link>
              <Link role="menuitem" to="/careers">
                {t("Careers") || "Careers"}
              </Link>
              <Link role="menuitem" to="/">
                {t("How it Works") || "How it Works"}
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="navbar-right">
        <Link to="/help" className="help-link">
          {t("Help") || "Help"}
        </Link>

        {loading ? (
          <span className="nav-skeleton" aria-busy="true" aria-live="polite">
            …
          </span>
        ) : !user ? (
          <Link to="/login" className="btn black">
            {t("Log in") || "Log in"}
          </Link>
        ) : (
          <div className="user-dropdown" ref={userDropdownRef}>
            <button
              className={`user-btn ${userOpen ? "open" : ""}`}
              onClick={() => setUserOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={userOpen}
              aria-controls="user-menu"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={t("User avatar") || "User avatar"}
                  className="nav-avatar"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              {profile?.nickname ||
                profile?.name ||
                (user.email ? user.email.split("@")[0] : "Account")}{" "}
              <VscChevronDown className="arrow" />
            </button>

            {userOpen && (
              <div id="user-menu" role="menu" className="user-dropdown-content">
                <Link
                  role="menuitem"
                  to="/messages"
                  className={unreadCount > 0 ? "highlight" : ""}
                >
                  {t("Messages") || "Messages"}{" "}
                  {unreadCount > 0 && <span>({unreadCount})</span>}
                </Link>
                <Link role="menuitem" to="/profile">
                  {t("Profile") || "Profile"}
                </Link>
                <Link role="menuitem" to="/my-rides">
                  {t("My Rides") || "My Rides"}
                </Link>
                <button
                  role="menuitem"
                  onClick={handleLogout}
                  className="logout-btn"
                >
                  {t("Log out") || "Log out"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
