import React from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";

export default function CreatingAccount() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Creating an Account" },
  ];

  return (
    <div className="help-wrapper">
      <Breadcrumb items={breadcrumbItems} />

      <header className="help-header">
        <h1>Creating an Account</h1>
        <p className="subtext">
          Learn how to get started with your ShareRide profile.
        </p>
      </header>

      <section className="help-section">
        <p>To create an account:</p>
        <ol>
          <li>
            Go to the <Link to="/register">registration page</Link>.
          </li>
          <li>Fill in your name, email, and create a password.</li>
          <li>Click "Sign Up" and check your email for a verification link.</li>
          <li>Once verified, you can log in and complete your profile.</li>
        </ol>
        <p>
          Need help? <Link to="/help/contact">Contact support</Link>.
        </p>
      </section>
    </div>
  );
}
