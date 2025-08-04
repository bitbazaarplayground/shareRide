import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function PreparingToTravel() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Preparing to Travel" },
  ];

  return (
    <HelpArticleLayout
      title="Preparing to Travel"
      description="Checklist and best practices before your shared taxi ride."
      breadcrumb={breadcrumb}
    >
      <ul>
        <li>
          Confirm ride time and pickup location from your{" "}
          <strong>My Rides</strong> page.
        </li>
        <li>Verify luggage and passenger counts.</li>
        <li>Charge your phone and enable notifications.</li>
        <li>Arrive 5–10 minutes early to meet your ride partner or taxi.</li>
      </ul>
    </HelpArticleLayout>
  );
}
