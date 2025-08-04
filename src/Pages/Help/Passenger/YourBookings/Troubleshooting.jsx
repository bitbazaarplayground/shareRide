import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function Troubleshooting() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Troubleshooting" },
  ];

  return (
    <HelpArticleLayout
      title="Troubleshooting"
      description="Fix common booking and ride issues."
      breadcrumb={breadcrumb}
    >
      <ul>
        <li>
          Booking not showing? Make sure it was properly submitted and check
          Upcoming Rides.
        </li>
        <li>
          Unable to edit ride? Confirm it’s before the 48h modification window.
        </li>
        <li>
          Need to message a rider? Use the in-app chat under Upcoming Rides.
        </li>
      </ul>
    </HelpArticleLayout>
  );
}
