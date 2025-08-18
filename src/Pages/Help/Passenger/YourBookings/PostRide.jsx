import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Post-ride — TabFair",
  description: "What to do after your shared ride ends.",
  canonical: "https://www.tabfair.com/help/passenger/post-ride",
  published: "2025-08-18",
  modified: "2025-08-18",
};

export default function PostRide() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Post-ride" },
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
        title="Post-ride"
        description="What to do after your shared ride ends."
        breadcrumb={breadcrumb}
      >
        <ul>
          <li>Leave a review for the passenger(s) you shared a ride with.</li>
          <li>Provide feedback on the ride experience.</li>
          <li>If you left an item behind, reach out quickly to retrieve it.</li>
        </ul>
      </HelpArticleLayout>
    </>
  );
}
