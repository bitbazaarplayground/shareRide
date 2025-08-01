import React from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../Breadcrumb";

export default function AccountHelp() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account" },
  ];
  return (
    <div className="help-wrapper">
      <Breadcrumb items={breadcrumbItems} />

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
          <li>
            <Link to="/help/account/ratings">
              🔗 Leaving Ratings & Comments
            </Link>
          </li>
          <li>
            <Link to="/help/account/managing-your-account">
              🔗 Managing Your Account
            </Link>
          </li>
          <li>
            <Link to="/help/account/account-security">🔐 Account Security</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
