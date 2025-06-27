import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import "./StylesPages/Homepage.css";

export default function Homepage() {
  const { t } = useTranslation();

  return (
    <main className="homepage">
      <section className="hero">
        <div className="hero-content">
          <h1 className="brand-title">GoDutch</h1>
          <p className="tagline">
            Find and share rides easily with trusted users
          </p>
          <Link to="/search" className="cta-button">
            {t("Find a Ride")}
          </Link>
        </div>
      </section>

      <section className="features">
        <h2>Why GoDutch?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>🌍 Eco-friendly</h3>
            <p>Reduce emissions by sharing your ride.</p>
          </div>
          <div className="feature-card">
            <h3>🚗 Reliable Rides</h3>
            <p>All users are verified with complete profiles.</p>
          </div>
          <div className="feature-card">
            <h3>💸 Save Money</h3>
            <p>Share fuel costs and make new friends on the road.</p>
          </div>
        </div>
      </section>

      <section className="join-now">
        <h2>Ready to Go Dutch?</h2>
        <p>Create your profile and start your journey.</p>
        <Link to="/signup" className="cta-button secondary">
          Join Now
        </Link>
      </section>
    </main>
  );
}
