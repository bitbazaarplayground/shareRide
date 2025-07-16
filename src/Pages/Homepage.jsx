import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import Footer from "../Footer/Footer";
import "./StylesPages/Homepage.css";

export default function Homepage() {
  const { t } = useTranslation();
  const [showMainText, setShowMainText] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMainText(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <main className="homepage">
        {/* HERO SECTION */}
        <section className="hero-wrapper">
          <picture>
            <source
              srcSet="/images/carpoolImage-small.jpg"
              media="(max-width: 480px)"
            />
            <source
              srcSet="/images/carpoolImage-medium.jpg"
              media="(max-width: 1024px)"
            />
            <img
              src="/images/carpoolImage.png"
              alt="Happy people in a car sharing a ride"
              className="hero-img"
            />
          </picture>
          <div className="hero-overlay">
            {showMainText ? (
              <>
                <h1 className="brand-title">TabFair</h1>
                <p className="tagline">
                  Find and share rides easily with trusted users
                </p>
                <Link to="/all-rides" className="cta-button">
                  {t("Find a Ride")}
                </Link>
              </>
            ) : (
              <h1 className="tagline initial-message">
                Share the ride. Split the cost.
              </h1>
            )}
          </div>
        </section>

        {/* SAVINGS SECTION */}
        <section className="savings-comparison">
          <h2>See the Savings</h2>
          <div className="savings-grid">
            <div className="savings-card">
              <h3>🚖 Taxi</h3>
              <p>£66</p>
              <span className="note">Heathrow → Central London</span>
            </div>
            <div className="savings-card">
              <h3>🚆 Train</h3>
              <p>£22</p>
              <span className="note">Heathrow Express</span>
            </div>
            <div className="savings-card highlight">
              <h3>🤝 GoDutch</h3>
              <p>£16.50</p>
              <span className="note">Split Taxi (4 People)</span>
            </div>
          </div>
          <p className="savings-footnote">
            * Based on average rates and shared rides between 4 passengers.
          </p>
        </section>

        {/* FEATURES */}
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

        {/* HOW IT WORKS */}
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

        {/* TESTIMONIALS */}
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
                “GoDutch made my arrival in Manchester stress-free. I found a
                ride from the airport to my hotel in minutes.”
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

        {/* TRUST SECTION */}
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
      <Footer />
    </>
  );
}
