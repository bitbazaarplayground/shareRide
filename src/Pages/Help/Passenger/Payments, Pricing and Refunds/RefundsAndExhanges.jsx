// src/Pages/RefundsAndExchanges.jsx
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Refunds and Exchanges — TabFair",
  description:
    "Learn how ride cancellations work, when refunds are possible, and if cancellation fees apply.",
  canonical: "https://www.tabfair.com/help/passenger/refunds",
  published: "2025-08-17",
  modified: "2025-08-17",
};

export default function RefundsAndExchanges() {
  const webPageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: page.canonical,
    inLanguage: "en-GB",
    datePublished: page.published,
    dateModified: page.modified,
  };

  return (
    <>
      <Helmet>
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={page.canonical} />
        <script type="application/ld+json">{JSON.stringify(webPageLd)}</script>
      </Helmet>

      <HelpArticleLayout
        title="Refunds and Exchanges"
        description="Learn how ride cancellations work, when refunds are possible, and if cancellation fees apply."
        breadcrumb={[
          { label: "Help Centre", to: "/help" },
          { label: "Passenger", to: "/help/passenger" },
          { label: "Refunds and Exchanges" },
        ]}
      >
        <h2>Canceling a Ride</h2>
        <p>
          If you need to cancel your spot in a shared ride, the person who
          created the ride will be notified with this message:
        </p>
        <blockquote>
          <strong>[Your Name]</strong> wants to cancel their ride. If you
          accept, they will no longer split the fare with you. Would you like
          to:
          <ul>
            <li>A) Accept</li>
            <li>B) Only accept if another user takes their place</li>
            <li>C) Cancel this cancellation request</li>
          </ul>
        </blockquote>

        <h2>Refund Eligibility</h2>
        <ul>
          <li>
            <strong>Accepted (Option A):</strong> You will receive a full
            refund, minus any cancellation fees.
          </li>
          <li>
            <strong>Accepted with Replacement (Option B):</strong> You'll be
            refunded only if another user joins and takes your place. A
            cancellation fee may still apply depending on timing or account
            history.
          </li>
          <li>
            <strong>Request Canceled (Option C or Replacement Fails):</strong>{" "}
            You remain part of the ride and are not eligible for a refund.
          </li>
        </ul>

        <h2>Cancellation Fees</h2>
        <p>
          Depending on the time before departure and previous cancellations, a
          small cancellation fee may apply. This will be shown before confirming
          your request.
        </p>

        <h2>After Booking with a Ride Provider</h2>
        <p>
          If the ride has already been booked with a third-party provider (e.g.,
          Uber or Bolt), refunds must be handled directly with them via their
          app.
        </p>

        <p>
          <Link to="/help">Back to Help Centre</Link>
        </p>
      </HelpArticleLayout>
    </>
  );
}
