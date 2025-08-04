import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function LostItem() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Lost Item in Ride" },
  ];

  return (
    <HelpArticleLayout
      title="Lost Item in Ride"
      description="Steps to take if you left something behind in the taxi."
      breadcrumb={breadcrumb}
    >
      <p>If you lost an item during your shared taxi ride:</p>

      <ol>
        <li>
          Message your co-passenger through{" "}
          <strong>My Rides &gt; Past Rides</strong>
        </li>
        <li>
          If you used a third-party taxi provider, try contacting them directly
          with ride time and route details
        </li>
        <li>
          If urgent or no response, <a href="/help/contact">contact support</a>
        </li>
      </ol>

      <p>
        Always double-check the taxi before exiting. Ride partners are usually
        happy to help if contacted quickly!
      </p>
    </HelpArticleLayout>
  );
}
