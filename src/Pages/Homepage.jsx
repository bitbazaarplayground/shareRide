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
    }, 5000);

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
              <p className="tagline">
                Find and share rides easily with trusted users
              </p>
            ) : (
              <h1 className="tagline initial-message">
                Share the ride. Split the cost.
              </h1>
            )}
          </div>
        </section>
        {/* TOP WAVE (OUTSIDE HERO WRAPPER) */}
        <div className="orange-bottom-wave">
          <svg
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#e66000"
              d="
              M0,120
              C20,110 1440,260 1640,40
              C640,180 180,90 0,80
              Z"
            />
          </svg>
        </div>

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
              <h3>🤝 Tabfair</h3>
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
          <h2>Why Tabfair?</h2>
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

        {/* BOTTOM WAVE */}
        {/* <div className="wave wave-bottom">
          <svg
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#e66000"
              fillOpacity="1"
              d="M0,96 C480,0 960,192 1440,96 L1440,0 L0,0 Z"
            />
          </svg>
        </div> */}

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
                src="/images/testimonial3.png"
                alt="User avatar"
                className="testimonial-avatar"
              />
              <blockquote>
                “We had just landed from Mexico and dreaded the long trip to
                Chelmsford. Then we found Tabfair. Shared a taxi from Heathrow
                and ended up saving money — plus, we had great company the whole
                way!”
                <footer>— James & Ana, Returning from Holiday</footer>
              </blockquote>
            </div>

            <div className="testimonial-card">
              <img
                src="/images/testimonial2.png"
                alt="User avatar"
                className="testimonial-avatar"
              />
              <blockquote>
                “I booked a ride to catch a football match — trains were packed,
                but sharing a taxi was smooth, cheaper, and actually fun. It
                just makes sense.”
                <footer>— Liam, Football Fan</footer>
              </blockquote>
            </div>

            <div className="testimonial-card">
              <img
                src="/images/testimonial1.png"
                alt="User avatar"
                className="testimonial-avatar"
              />
              <blockquote>
                “After a long flight from Singapore, I really didn’t want to
                deal with expensive taxis alone. Sharing my ride helped me save
                money and felt good knowing I was making a greener choice.”
                <footer>— Mei, International Student</footer>
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
            <li>Suppor local taxi drivers</li>
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
