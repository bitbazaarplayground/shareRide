import React from "react";
import { Link } from "react-router-dom";
import "./StylesHelp/HelpAccount.css"; // adjust path as needed

export default function AccountHelp() {
  return (
    <div className="help-wrapper">
      <header className="help-header">
        <h1>Your Profile & Account</h1>
        <p className="subtext">
          Get help with managing your account, settings, and login issues.
        </p>
      </header>

      <section className="help-links-section">
        <ul className="help-sublinks">
          <li>
            <Link to="/help/account/creating-account">
              🔗 Creating an account
            </Link>
          </li>
          <li>
            <Link to="/help/account/manage-profile">
              🔗 Managing your profile
            </Link>
          </li>
          <li>
            <Link to="/help/account/login-troubleshooting">
              🔗 Troubleshooting login
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
