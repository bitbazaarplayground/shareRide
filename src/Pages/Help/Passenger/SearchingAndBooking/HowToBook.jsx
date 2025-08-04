import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function HowToBook() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "How to Book" },
  ];

  return (
    <HelpArticleLayout
      title="How to Book"
      description="Steps to book a ride through Tabfair and what happens next."
      breadcrumb={breadcrumb}
    >
      <ol>
        <li>Find a ride that fits your location, time, and space needs.</li>
        <li>
          Click <strong>“Request to Join”</strong> — your booking is
          automatically submitted.
        </li>
        <li>
          The ride creator (host) has up to <strong>10 minutes</strong> to
          reject your request.
        </li>
        <li>
          If accepted, you'll see confirmation in <strong>My Rides</strong>.
        </li>
        <li>
          If denied, you can either:
          <ul>
            <li>Join another ride</li>
            <li>Or post your own ride to attract co-passengers</li>
          </ul>
        </li>
      </ol>
    </HelpArticleLayout>
  );
}
