import React from "react";
import { Link } from "react-router-dom";
import HelpArticleLayout from "../../../HelpArticleLayout";

export default function DeleteProfileHelp() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    {
      label: "Managing Your Account",
      to: "/help/account/managing-your-account",
    },
    { label: "Deleting Your Profile" },
  ];

  return (
    <HelpArticleLayout
      title="Deleting Your Profile"
      description="Need to leave ShareRide? Here's how to delete your account."
      breadcrumb={breadcrumbItems}
    >
      <h2>Important before deleting</h2>
      <ul>
        <li>All your ride history and messages will be permanently removed.</li>
        <li>You will lose access to your account and booked rides.</li>
      </ul>

      <h2>How to delete your profile</h2>
      <ol>
        <li>Log in to your account.</li>
        <li>
          Go to <strong>Account Settings</strong> &gt; <strong>Privacy</strong>.
        </li>
        <li>
          Click <strong>Delete My Account</strong>.
        </li>
        <li>Confirm the action when prompted.</li>
      </ol>

      <p>
        Changed your mind? You can always contact{" "}
        <Link to="/help/contact">Support</Link> before deletion.
      </p>
    </HelpArticleLayout>
  );
}
