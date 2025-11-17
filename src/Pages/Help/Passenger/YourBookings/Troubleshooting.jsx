import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Troubleshooting — TabFair",
  description: "Fix common booking and ride issues.",
  canonical: "https://www.tabfair.com/help/passenger/troubleshooting",
  published: "2025-08-18",
  modified: "2025-08-18",
};

export default function Troubleshooting() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Troubleshooting" },
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
        title="Troubleshooting"
        description="Fix common booking and ride issues."
        breadcrumb={breadcrumb}
      >
        <ul>
          <li>
            Booking not showing? Make sure it was properly submitted and check
            Upcoming Rides.
          </li>
          <li>
            Unable to edit ride? Confirm it’s before the 48h modification
            window.
          </li>
          <li>
            Need to message a rider? Use the in-app chat under Upcoming Rides.
          </li>
        </ul>
      </HelpArticleLayout>
    </>
  );
}
