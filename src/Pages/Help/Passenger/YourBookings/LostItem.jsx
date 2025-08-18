import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Lost Item in Ride — TabFair",
  description: "Steps to take if you left something behind in the taxi.",
  canonical: "https://www.tabfair.com/help/passenger/lost-item",
  published: "2025-08-18",
  modified: "2025-08-18",
};

export default function LostItem() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Lost Item in Ride" },
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
        title="Lost Item in Ride"
        description="Steps to take if you left something behind in the taxi."
        breadcrumb={breadcrumb}
      >
        <p>If you lost an item during your shared taxi ride:</p>

        <ol>
          <li>
            Message your co-passenger through{" "}
            <strong>My Rides &gt; Past Rides</strong>
          </li>
          <li>
            If you used a third-party taxi provider, try contacting them
            directly with ride time and route details
          </li>
          <li>
            If urgent or no response,{" "}
            <a href="/help/contact">contact support</a>
          </li>
        </ol>

        <p>
          Always double-check the taxi before exiting. Ride partners are usually
          happy to help if contacted quickly!
        </p>
      </HelpArticleLayout>
    </>
  );
}
