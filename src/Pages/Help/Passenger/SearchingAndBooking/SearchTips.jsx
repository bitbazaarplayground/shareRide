// src/Pages/SearchTips.jsx
import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Search Tips — TabFair",
  description:
    "How to find the perfect shared ride using location, time, and filters.",
  canonical: "https://www.tabfair.com/help/passenger/search-tips",
  published: "2025-08-17",
  modified: "2025-08-17",
};

export default function SearchTips() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Search Tips" },
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
        title="Search Tips"
        description="How to find the perfect shared ride using location, time, and filters."
        breadcrumb={breadcrumb}
      >
        <ul>
          <li>
            Use the <strong>"From"</strong> and <strong>"To"</strong> fields to
            define your route.
          </li>
          <li>
            Narrow down by <strong>departure time</strong> for precise results.
          </li>
          <li>Specify how many seats and luggage space you need.</li>
          <li>
            For better matches, try searching by{" "}
            <strong>distance radius</strong> — in meters. Options:{" "}
            <code>1, 5, 10, 25, 50, 100, 250, 500</code>.
          </li>
          <li>
            For better matches, try searching from transport hubs like Heathrow
            or King's Cross.
          </li>
        </ul>
        <p>
          The system will only show available rides that meet your criteria — no
          overbooked or mismatched rides.
        </p>
      </HelpArticleLayout>
    </>
  );
}
