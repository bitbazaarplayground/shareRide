// src/Pages/InvoicesAndReceipts.jsx
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Invoices and Receipts — TabFair",
  description:
    "After pre-paying, you'll receive a receipt from TabFair. Learn how to find ride provider receipts as well.",
  canonical: "https://www.tabfair.com/help/passenger/invoices",
  published: "2025-08-17",
  modified: "2025-08-17",
};

export default function InvoicesAndReceipts() {
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
        title="Invoices and Receipts"
        description=""
        breadcrumb={[
          { label: "Help Centre", to: "/help" },
          { label: "Passenger", to: "/help/passenger" },
          { label: "Invoices and Receipts" },
        ]}
      >
        <p>
          After pre-paying, you'll receive a receipt from TabFair. Discussions
          with the ride provider (e.g. Uber/Bolt) about their receipt must be
          handled in their respective applications.
        </p>

        <h2>Your TabFair receipt</h2>
        <p>
          You can download or email your receipt from your account’s “Payment
          History” section.
        </p>

        <h2>Provider receipts</h2>
        <p>
          Uber/Bolt will issue a separate receipt after the ride — check your
          email or ride provider app.
        </p>

        <p>
          <Link to="/help">Back to Help Centre</Link>
        </p>
      </HelpArticleLayout>
    </>
  );
}
