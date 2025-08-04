import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function Cancellations() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Cancellations" },
  ];

  return (
    <HelpArticleLayout
      title="Cancellations"
      description="Understand when and how bookings can be cancelled."
      breadcrumb={breadcrumb}
    >
      <ul>
        <li>
          You can cancel a booking up to{" "}
          <strong>48 hours before departure</strong>.
        </li>
        <li>
          Cancellations within 48h may still incur charges unless all users
          agree.
        </li>
        <li>
          If all users mutually agree, you can cancel after 48h—but cancellation
          rules still apply.
        </li>
      </ul>
      <p>
        All cancellations are managed via your{" "}
        <strong>My Rides → Upcoming Rides</strong> page.
      </p>
    </HelpArticleLayout>
  );
}
