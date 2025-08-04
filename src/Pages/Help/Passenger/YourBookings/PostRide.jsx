import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function PostRide() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Post‑ride" },
  ];

  return (
    <HelpArticleLayout
      title="Post‑ride"
      description="What to do after your shared ride ends."
      breadcrumb={breadcrumb}
    >
      <ul>
        <li>Leave a review for the passenger(s) you shared a ride with.</li>
        <li>Provide feedback on the ride experience.</li>
        <li>If you left an item behind, reach out quickly to retrieve it.</li>
      </ul>
    </HelpArticleLayout>
  );
}
