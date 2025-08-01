import React from "react";
import { Link } from "react-router-dom";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function ManageAccountOverview() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Managing Your Account" },
  ];

  return (
    <HelpArticleLayout
      title="Managing Your Account"
      description="Learn how to adjust your ShareRide settings, update your profile, or close your account."
      breadcrumb={breadcrumbItems}
    >
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
    </HelpArticleLayout>
  );
}
