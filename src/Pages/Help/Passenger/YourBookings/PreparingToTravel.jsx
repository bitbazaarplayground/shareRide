import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Preparing to Travel — TabFair",
  description: "Checklist and best practices before your shared taxi ride.",
  canonical: "https://www.tabfair.com/help/passenger/preparing-travel",
  published: "2025-08-18",
  modified: "2025-08-18",
};

export default function PreparingToTravel() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Preparing to Travel" },
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
        title="Preparing to Travel"
        description="Checklist and best practices before your shared taxi ride."
        breadcrumb={breadcrumb}
      >
        <ul>
          <li>
            Confirm ride time and pickup location from your{" "}
            <strong>My Rides</strong> page.
          </li>
          <li>Verify luggage and passenger counts.</li>
          <li>Charge your phone and enable notifications.</li>
          <li>Arrive 5–10 minutes early to meet your ride partner or taxi.</li>
        </ul>
      </HelpArticleLayout>
    </>
  );
}
