// src/Pages/FindBooking.jsx
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "How to Find Your Booking — TabFair",
  description:
    "Locate upcoming and recent rides easily in the My Rides dashboard.",
  canonical: "https://www.tabfair.com/help/passenger/find-booking",
  published: "2025-08-18",
  modified: "2025-08-18",
};

export default function FindBooking() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "How to Find Your Booking" },
  ];

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
        title="How to Find Your Booking"
        description="Locate upcoming and recent rides easily in the My Rides dashboard."
        breadcrumb={breadcrumb}
      >
        <ol>
          <li>Log in to your Tabfair account.</li>
          <li>
            Click the menu in the top-right corner and select{" "}
            <Link to="/my-rides">My Rides</Link>.
          </li>
          <li>
            Go to the <Link to="/my-rides?tab=booked">Booked Rides</Link> tab to
            see your bookings.
          </li>
        </ol>
        <p>
          If a booking is missing, double-check your confirmation email or
          refresh your My Rides page.
        </p>
      </HelpArticleLayout>
    </>
  );
}
