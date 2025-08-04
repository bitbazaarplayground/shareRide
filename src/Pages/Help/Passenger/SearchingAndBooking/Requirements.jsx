import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function Requirements() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Requirements" },
  ];

  return (
    <HelpArticleLayout
      title="Requirements to Book"
      description="Everything you need before you can book a ride on Tabfair."
      breadcrumb={breadcrumb}
    >
      <ul>
        <li>You must be a registered user on Tabfair.</li>
        <li>Verify your email address or Facebook account during sign-up.</li>
        <li>
          Ensure your profile is up to date (name, photo, contact info) to
          increase booking acceptance.
        </li>
        <li>
          You must declare the number of <strong>passengers</strong> and amount
          of <strong>luggage</strong> you're traveling with.
        </li>
      </ul>
    </HelpArticleLayout>
  );
}
