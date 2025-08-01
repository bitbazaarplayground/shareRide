import React from "react";
import Breadcrumb from "../Breadcrumb";

export default function ManageProfile() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Managing Your Profile" },
  ];
  return (
    <div className="help-wrapper">
      <Breadcrumb items={breadcrumbItems} />
      <header className="help-header">
        <h1>Managing Your Profile</h1>
        <p className="subtext">
          Update your photo, contact info, and preferences.
        </p>
      </header>

      <section className="help-section">
        <p>To manage your profile:</p>
        <ol>
          <li>Log in to your account.</li>
          <li>Click on your profile picture in the top-right corner.</li>
          <li>
            Select <strong>"My Account"</strong> from the dropdown menu.
          </li>
          <li>
            Here you can update your name, photo, bio, contact number, and more.
          </li>
          <li>Click "Save Changes" when you're done.</li>
        </ol>
        <p>
          Profile updates are instant, but you may need to refresh the page.
        </p>
      </section>
    </div>
  );
}
