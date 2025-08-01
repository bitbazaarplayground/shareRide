import React from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../Breadcrumb";

export default function LoginTroubleshooting() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Troubleshooting Login" },
  ];
  return (
    <div className="help-wrapper">
      <Breadcrumb items={breadcrumbItems} />
      <header className="help-header">
        <h1>Troubleshooting Login</h1>
        <p className="subtext">Having trouble logging in? Let’s fix that.</p>
      </header>

      <section className="help-section">
        <h2>Forgot your password?</h2>
        <p>
          Go to the <Link to="/login">login page</Link> and click{" "}
          <strong>"Forgot Password"</strong>. Follow the instructions in your
          email to reset your password.
        </p>

        <h2>Didn't receive the reset email?</h2>
        <ul>
          <li>Check your spam/junk folder.</li>
          <li>Make sure you entered the correct email address.</li>
          <li>
            Still no luck? <Link to="/help/contact">Contact support</Link>.
          </li>
        </ul>

        <h2>Other Issues</h2>
        <p>
          If you're experiencing issues with social login (e.g., Google), try
          logging in with another method or clearing your browser cache.
        </p>
      </section>
    </div>
  );
}
