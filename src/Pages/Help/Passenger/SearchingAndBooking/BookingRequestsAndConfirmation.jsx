import React from "react";
import HelpArticleLayout from "../../HelpArticleLayout";

export default function BookingRequestsAndConfirmation() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Booking Requests & Confirmation" },
  ];

  return (
    <HelpArticleLayout
      title="Booking Requests & Confirmation"
      description="What happens after you request to join a ride on Tabfair?"
      breadcrumb={breadcrumb}
    >
      <p>Once you request to join a ride:</p>
      <ol>
        <li>
          Your booking is automatically submitted to the ride poster (host).
        </li>
        <li>
          The host has <strong>10 minutes</strong> to accept or reject the
          booking.
        </li>
        <li>
          If <strong>accepted</strong>, your spot is confirmed and you’ll see
          the ride in your <strong>Upcoming Rides</strong>.
        </li>
        <li>
          A <strong>confirmation email</strong> will be sent to your registered
          address with ride details.
        </li>
        <li>
          If <strong>rejected</strong>, you’ll be notified and can:
          <ul>
            <li>Search and request a different ride</li>
            <li>Or post your own ride as a host</li>
          </ul>
        </li>
      </ol>
    </HelpArticleLayout>
  );
}
