import React from "react";
import HelpArticleLayout from "../../../HelpArticleLayout";

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
    <HelpArticleLayout
      title="Editing or Changing Your Profile"
      description="Keep your ShareRide profile up to date and accurate."
      breadcrumb={breadcrumbItems}
    >
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
    </HelpArticleLayout>
  );
}
