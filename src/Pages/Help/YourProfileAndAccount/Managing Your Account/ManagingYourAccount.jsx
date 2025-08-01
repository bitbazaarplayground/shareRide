import React from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../../Breadcrumb"; // adjust path if needed
import "../../StylesHelp/Help.css"; // adjust path if needed

export default function ManageAccountOverview() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Managing Your Account" },
  ];

  return (
    <div className="help-wrapper">
      <Breadcrumb items={breadcrumbItems} />

      <header className="help-header">
        <h1>Managing Your Account</h1>
        <p className="subtext">
          Learn how to adjust your ShareRide settings, update your profile, or
          close your account.
        </p>
      </header>

      <section className="help-section">
        <ul className="help-sublinks">
          <li>
            <Link to="/help/account/notifications">
              🔔 Notifications and Communication
            </Link>
          </li>
          <li>
            <Link to="/help/account/edit-profile">
              ✏️ Editing or Changing Your Profile
            </Link>
          </li>
          <li>
            <Link to="/help/account/delete-profile">
              🗑️ Deleting Your Profile
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
