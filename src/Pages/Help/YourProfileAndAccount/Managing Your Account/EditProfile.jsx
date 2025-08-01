import React from "react";
import Breadcrumb from "../../Breadcrumb";
import "../../StylesHelp/Help.css";

export default function EditProfileHelp() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    {
      label: "Managing Your Account",
      to: "/help/account/managing-your-account",
    },
    { label: "Editing Your Profile" },
  ];

  return (
    <div className="help-wrapper">
      <Breadcrumb items={breadcrumbItems} />

      <header className="help-header">
        <h1>Editing or Changing Your Profile</h1>
        <p className="subtext">
          Keep your ShareRide profile up to date and accurate.
        </p>
      </header>

      <section className="help-section">
        <h2>What can you change?</h2>
        <ul>
          <li>Profile photo</li>
          <li>Bio / About me</li>
          <li>Phone number and email</li>
          <li>Preferred language and contact method</li>
        </ul>

        <h2>How to edit</h2>
        <ol>
          <li>
            Log in and go to <strong>My Account</strong>.
          </li>
          <li>
            Click <strong>Edit Profile</strong>.
          </li>
          <li>Update any fields you wish to change.</li>
          <li>
            Click <strong>Save</strong> to apply your updates.
          </li>
        </ol>
      </section>
    </div>
  );
}
