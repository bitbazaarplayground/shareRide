// src/Pages/Requirements.jsx
import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Requirements to Book — TabFair",
  description: "Everything you need before you can book a ride on Tabfair.",
  canonical: "https://www.tabfair.com/help/passenger/requirements",
  published: "2025-08-17",
  modified: "2025-08-17",
};

export default function Requirements() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Requirements" },
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
        title="Requirements to Book"
        description="Everything you need before you can book a ride on Tabfair."
        breadcrumb={breadcrumb}
      >
        <ul>
          <li>You must be a registered user on Tabfair.</li>
          <li>
            Verify your email address, Google or Facebook account during
            sign-up.
          </li>
          <li>
            Ensure your profile is up to date (name, photo, contact info) to
            increase booking acceptance.
          </li>
          <li>
            You must declare the number of <strong>passengers</strong> and
            amount of <strong>luggage</strong> you're traveling with.
          </li>
        </ul>
      </HelpArticleLayout>
    </>
  );
}
