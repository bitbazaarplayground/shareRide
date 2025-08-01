import React from "react";
import HelpArticleLayout from "../../../HelpArticleLayout";

export default function NotificationsHelp() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    {
      label: "Managing Your Account",
      to: "/help/account/managing-your-account",
    },
    { label: "Notifications & Communication" },
  ];

  return (
    <HelpArticleLayout
      title="Notifications & Communication"
      description="Manage how you receive updates about rides and account activity."
      breadcrumb={breadcrumbItems}
    >
      <h2>Where to manage notifications</h2>
      <ol>
        <li>
          Log in to your account and go to <strong>Account Settings</strong>.
        </li>
        <li>
          Select the <strong>Notifications</strong> tab.
        </li>
        <li>
          Toggle on/off email, SMS, or in-app notifications based on your
          preference.
        </li>
      </ol>

      <h2>Types of notifications</h2>
      <ul>
        <li>Ride reminders and status updates</li>
        <li>Messages and chat activity</li>
        <li>Account security and login alerts</li>
        <li>News, promotions, and feature updates (optional)</li>
      </ul>
    </HelpArticleLayout>
  );
}
