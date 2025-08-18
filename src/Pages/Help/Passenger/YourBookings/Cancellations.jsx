import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Cancellations — TabFair",
  description: "Understand when and how bookings can be cancelled.",
  canonical: "https://www.tabfair.com/help/passenger/cancellations",
  published: "2025-08-18",
  modified: "2025-08-18",
};

export default function Cancellations() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Cancellations" },
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
            If all users mutually agree, you can cancel after 48h—but
            cancellation rules still apply.
          </li>
        </ul>
        <p>
          All cancellations are managed via your{" "}
          <strong>My Rides → Upcoming Rides</strong> page.
        </p>
      </HelpArticleLayout>
    </>
  );
}
