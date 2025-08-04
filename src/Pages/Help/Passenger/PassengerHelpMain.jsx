import React from "react";
import { Link } from "react-router-dom";

import Breadcrumb from "../Breadcrumb";
import "./StylePassengerHelp/PassengerHelpMain.css";

export default function PassengerHelp() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Passenger" },
  ];

  return (
    <div className="help-wrapper">
      <Breadcrumb items={breadcrumbItems} />

      <header className="help-header">
        <h1>Help for Passengers</h1>
        <p className="subtext">
          Everything you need to know about searching, booking, paying, and
          riding with Tabfair.
        </p>
      </header>

      <section className="help-links-section">
        <h3>🔍 Searching and Bookings</h3>
        <ul className="help-sublinks">
          <li>
            <Link to="/help/passenger/search-tips">🔎 Search Tips</Link>
          </li>
          <li>
            <Link to="/help/passenger/how-to-book">📘 How to Book</Link>
          </li>
          <li>
            <Link to="/help/passenger/requirements">📋 Requirements</Link>
          </li>
          <li>
            <Link to="/help/passenger/booking-confirmation">
              ✅ Booking Requests and Confirmation
            </Link>
          </li>
          <li>
            <Link to="/help/passenger/communicating-drivers">
              💬 Communicating With Drivers Before Booking
            </Link>
          </li>
          <li>
            <Link to="/help/passenger/luggage">🧳 Luggage</Link>
          </li>
        </ul>

        <h3>💳 Payments, Pricing and Refunds</h3>
        <ul className="help-sublinks">
          <li>
            <Link to="/help/passenger/payment-methods">
              💰 Paying for a Ride
            </Link>
          </li>
          <li>
            <Link to="/help/passenger/pricing">💵 Pricing</Link>
          </li>
          <li>
            <Link to="/help/passenger/refunds">↩️ Refunds and Exchanges</Link>
          </li>
          <li>
            <Link to="/help/passenger/invoices">📄 Invoices and Receipts</Link>
          </li>
        </ul>

        <h3>📂 Your Bookings</h3>
        <ul className="help-sublinks">
          <li>
            <Link to="/help/passenger/find-booking">
              🔎 How to Find Your Booking
            </Link>
          </li>
          <li>
            <Link to="/help/passenger/cancellations">❌ Cancellations</Link>
          </li>
          <li>
            <Link to="/help/passenger/change-booking">
              🔄 How to Change Your Booking
            </Link>
          </li>
          <li>
            <Link to="/help/passenger/preparing-travel">
              🎒 Preparing to Travel
            </Link>
          </li>
          <li>
            <Link to="/help/passenger/post-ride">📝 Post-ride</Link>
          </li>
          <li>
            <Link to="/help/passenger/lost-item">📦 Lost Item in Ride</Link>
          </li>
          <li>
            <Link to="/help/passenger/troubleshooting">🛠️ Troubleshooting</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
