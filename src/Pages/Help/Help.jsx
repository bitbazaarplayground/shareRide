import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../../Components/Navbar";
import "./StylesHelp/Help.css";

export default function HelpPage() {
  return (
    <>
      <Navbar variant="solid" />
      <div className="help-wrapper">
        {/* Top Header */}
        <header className="help-header">
          <h1>How can we help?</h1>
          <div className="search-box">
            <input type="text" placeholder="Search help articles" />
            <button aria-label="Search">🔍</button>
          </div>
        </header>

        {/* Help Category Cards */}
        <section className="help-cards">
          <Link to="/help/passenger" className="help-card">
            <img src="/images/PassengerHelp.png" alt="Passenger" />
            <span>Passenger</span>
          </Link>
          <Link to="/help/driver" className="help-card">
            <img src="public/images/taxiHelp.avif" alt="Driver" />
            <span>Driver</span>
          </Link>
          <Link to="/help/account" className="help-card">
            <img
              src="public/images/YourProfileHelp.jpeg"
              alt="Your Profile and Account"
            />
            <span>Your Profile & Account</span>
          </Link>
          <Link to="/help/safety" className="help-card">
            <img src="public/images/TrustSafeHelp.png" alt="Trust and Safety" />
            <span>Trust, Safety & Accessibility</span>
          </Link>
          <Link to="/help/about" className="help-card">
            <img src="/images/help/about.png" alt="About App" />
            <span>About ShareRide</span>
          </Link>
        </section>

        {/* Article Sections */}
        <section className="articles-section">
          <div className="articles-box">
            <h2>Top Articles</h2>
            <ul>
              <li>
                <Link to="/help/rating-driver">Rating your carpool driver</Link>
              </li>
              <li>
                <Link to="/help/passenger-cancellation">
                  Passenger cancellation rate
                </Link>
              </li>
            </ul>
          </div>

          <div className="articles-box">
            <h2>Suggested Articles</h2>
            <ul>
              <li>
                <Link to="/help/luggage-policy">Bus Luggage Policy</Link>
              </li>
              <li>
                <Link to="/help/booking">Booking a bus online</Link>
              </li>
              <li>
                <Link to="/help/bus-cancellation">Bus Cancellation Policy</Link>
              </li>
              <li>
                <Link to="/help/cancel-booking">
                  Cancelling your bus booking
                </Link>
              </li>
              <li>
                <Link to="/help/offering-ride">Offering a ride</Link>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
