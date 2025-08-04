import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function CommunicatingWithDrivers() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Communicating with Drivers" },
  ];

  return (
    <HelpArticleLayout
      title="Communicating with Drivers"
      description="How to reach out and coordinate with your ride partners or drivers."
      breadcrumb={breadcrumb}
    >
      <p>
        On Tabfair, once a ride is confirmed, you can message your ride partner
        directly through the platform’s messaging feature.
      </p>

      <ul>
        <li>
          Go to <strong>My Rides &gt; Upcoming Rides</strong>
        </li>
        <li>
          Select the ride and click <strong>"Message"</strong> to start chatting
        </li>
        <li>You can share your live location if needed</li>
        <li>
          Use messages to confirm meeting points, estimated arrival times, or
          special requests
        </li>
      </ul>

      <p>
        Communication is essential for smooth coordination, especially when
        using third-party taxis.
      </p>
    </HelpArticleLayout>
  );
}
