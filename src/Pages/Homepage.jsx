import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import "./StylesPages/Homepage.css";

export default function Homepage() {
  const { t } = useTranslation();

  return (
    <main className="homepage">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="brand-title">GoDutch</h1>
          <p className="tagline">
            Find and share rides easily with trusted users
          </p>
          <Link to="/all-rides" className="cta-button">
            {t("Find a Ride")}
          </Link>
        </div>
      </section>

      {/* Features */}
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

      {/* How It Works */}
      <section className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps-grid">
          <div className="step">
            <h4>1. Post a Ride</h4>
            <p>Tell us where you're going and when.</p>
          </div>
          <div className="step">
            <h4>2. Find Matches</h4>
            <p>Search or browse rides offered by others.</p>
          </div>
          <div className="step">
            <h4>3. Travel Together</h4>
            <p>Connect, travel and split the costs.</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {/* Testimonials */}
      <section className="testimonials">
        <h2>What Our Users Say</h2>
        <div className="testimonial-grid">
          <div className="testimonial-card">
            <img
              src="https://api.dicebear.com/8.x/thumbs/svg?seed=Emily"
              alt="User avatar"
              className="testimonial-avatar"
            />
            <blockquote>
              “GoDutch made my arrival in Manchester stress-free. I found a ride
              from the airport to my hotel in minutes.”
              <footer>— Sarah, Tourist from Spain</footer>
            </blockquote>
          </div>
          <div className="testimonial-card">
            <img
              src="https://api.dicebear.com/8.x/thumbs/svg?seed=Ahmed"
              alt="User avatar"
              className="testimonial-avatar"
            />
            <blockquote>
              “I travel for business often, and this platform has been a
              game-changer for quick airport pickups.”
              <footer>— Ahmed, Business Traveller</footer>
            </blockquote>
          </div>
          <div className="testimonial-card">
            <img
              src="https://api.dicebear.com/8.x/thumbs/svg?seed=Sarah"
              alt="User avatar"
              className="testimonial-avatar"
            />
            <blockquote>
              “Booked a ride from Heathrow to my Airbnb — affordable and met a
              friendly local!”
              <footer>— Emily, Backpacker</footer>
            </blockquote>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="trust">
        <h2>Travel Safely</h2>
        <ul>
          <li>✔ Verified profiles</li>
          <li>✔ Chat before your ride</li>
          <li>✔ Transparent reviews and ratings</li>
        </ul>
      </section>

      {/* CTA Join Now */}
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
