// src/Pages/Pricing.jsx
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Pricing — TabFair",
  description: "Understand how fare is calculated and what you're paying for.",
  canonical: "https://www.tabfair.com/help/passenger/pricing",
  published: "2025-08-17",
  modified: "2025-08-17",
};

export default function Pricing() {
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
        title="Pricing"
        description=""
        breadcrumb={[
          { label: "Help Centre", to: "/help" },
          { label: "Passenger", to: "/help/passenger" },
          { label: "Pricing" },
        ]}
      >
        <p>
          Your fare is calculated based on the ride provider’s rates — we
          transparently split this cost among passengers.
        </p>

        <h2>How fares are determined</h2>
        <ul>
          <li>
            Fares depend on the provider (Uber, Bolt, etc.) and distance/time.
          </li>
          <li>You pay exactly your share — no extra markup or service fee.</li>
          <li>
            If rates change before booking, you're charged the updated fare.
          </li>
        </ul>

        <h2>Before booking</h2>
        <p>
          You'll see an estimate of the total fare and your share before
          payment. Any difference after booking is adjusted by TabFair.
        </p>

        <p>
          <Link to="/help">Back to Help Centre</Link>
        </p>
      </HelpArticleLayout>
    </>
  );
}
