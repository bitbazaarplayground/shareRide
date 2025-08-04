import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function FindBooking() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "How to Find Your Booking" },
  ];

  return (
    <HelpArticleLayout
      title="How to Find Your Booking"
      description="Locate upcoming and recent rides easily in the My Rides dashboard."
      breadcrumb={breadcrumb}
    >
      <ol>
        <li>Log in to your Tabfair account.</li>
        <li>
          Click the menu in the top-right corner and select{" "}
          <strong>My Rides</strong>.
        </li>
        <li>
          Go to the <strong>Upcoming Rides</strong> tab to see your bookings.
        </li>
      </ol>
      <p>
        If a booking is missing, double-check your confirmation email or refresh
        your My Rides page.
      </p>
    </HelpArticleLayout>
  );
}
