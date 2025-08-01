import React from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../Breadcrumb"; // adjust path if needed

import "../StylesHelp/Help.css"; // adjust path if needed
export default function RatingsHelp() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Leaving Ratings & Comments" },
  ];

  return (
    <div className="help-wrapper">
      <Breadcrumb items={breadcrumbItems} />

      <header className="help-header">
        <h1>Leaving Ratings & Comments</h1>
        <p className="subtext">
          Learn how to leave feedback for passengers after your ride is
          completed.
        </p>
      </header>

      <section className="help-section">
        <h2>When can I leave a rating?</h2>
        <p>
          You can leave a rating and optional comment for each passenger or
          driver once the ride has been completed. This helps maintain a
          respectful and safe experience for everyone on ShareRide.
        </p>

        <h2>Where to leave a rating</h2>
        <ol>
          <li>
            Go to your{" "}
            <Link to="/account/rides">Account &gt; Previous Rides</Link>.
          </li>
          <li>Find the ride you completed.</li>
          <li>
            If the ride is eligible for feedback, you'll see a{" "}
            <strong>"Leave a Rating"</strong> button.
          </li>
          <li>
            Select a star rating (1 to 5), and optionally write a short comment
            about your experience.
          </li>
          <li>
            Click <strong>Submit</strong> — your name will be attached to your
            feedback so others can learn from your experience.
          </li>
        </ol>

        <h2>Tips for meaningful feedback</h2>
        <ul>
          <li>Be honest, respectful, and constructive.</li>
          <li>
            Focus on the ride experience (punctuality, communication, safety,
            etc.).
          </li>
          <li>Do not include personal information.</li>
        </ul>

        <p>
          If you experience serious issues, please report them via the{" "}
          <Link to="/help/contact">Contact Support</Link> page.
        </p>
      </section>
    </div>
  );
}
