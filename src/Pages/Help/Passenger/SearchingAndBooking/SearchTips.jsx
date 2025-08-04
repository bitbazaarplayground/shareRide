import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function SearchTips() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Search Tips" },
  ];

  return (
    <HelpArticleLayout
      title="Search Tips"
      description="How to find the perfect shared ride using location, time, and filters."
      breadcrumb={breadcrumb}
    >
      <ul>
        <li>
          Use the <strong>"From"</strong> and <strong>"To"</strong> fields to
          define your route.
        </li>
        <li>
          Narrow down by <strong>departure time</strong> for precise results.
        </li>
        <li>Specify how many seats and luggage space you need.</li>
        <li>
          For better matches, try searching from transport hubs like Heathrow or
          King's Cross.
        </li>
      </ul>
      <p>
        The system will only show available rides that meet your criteria — no
        overbooked or mismatched rides.
      </p>
    </HelpArticleLayout>
  );
}
