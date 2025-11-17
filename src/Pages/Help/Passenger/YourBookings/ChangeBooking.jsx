import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "How to Change Your Booking — TabFair",
  description: "Options for modifying rides you’ve created or booked.",
  canonical: "https://www.tabfair.com/help/passenger/change-booking",
  published: "2025-08-18",
  modified: "2025-08-18",
};

export default function ChangeBooking() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "How to Change Your Booking" },
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
        title="How to Change Your Booking"
        description="Options for modifying rides you’ve created or booked."
        breadcrumb={breadcrumb}
      >
        <h2>If you posted a ride:</h2>
        <ul>
          <li>
            You can edit your ride via{" "}
            <strong>My Rides → Published Rides → Edit</strong>.
          </li>
          <li>
            Changes are allowed up to <strong>48 hours before departure</strong>{" "}
            and only if no one has joined yet.
          </li>
        </ul>

        <h2>If you booked someone else’s ride:</h2>
        <ul>
          <li>
            You can cancel up to <strong>48 hours before departure</strong>.
          </li>
          <li>
            For changes beyond that—like adjusting times—please message the ride
            host directly via the chat feature.
          </li>
        </ul>
      </HelpArticleLayout>
    </>
  );
}
