import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function Luggage() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Luggage" },
  ];

  return (
    <HelpArticleLayout
      title="Luggage Guidelines"
      description="How luggage affects bookings and ride coordination."
      breadcrumb={breadcrumb}
    >
      <ul>
        <li>
          When posting or joining a ride, you must specify the amount of luggage
          you’ll bring.
        </li>
        <li>
          The ride creator defines how many people and how much luggage the
          vehicle can handle.
        </li>
        <li>Make sure the total passengers and luggage fit in the taxi.</li>
        <li>
          Over-packing can prevent others from joining and may lead to ride
          denial.
        </li>
        <li>Fair distribution helps split costs evenly among participants.</li>
      </ul>
      <p style={{ marginTop: "1.5rem", fontWeight: "500", color: "#cc0000" }}>
        ⚠️ Please note: If you bring more passengers or luggage than declared,
        the ride host or taxi provider may deny you access to the ride. In such
        cases, Tabfair is not responsible, and you may still be liable for your
        share of the ride fare.
      </p>
    </HelpArticleLayout>
  );
}
