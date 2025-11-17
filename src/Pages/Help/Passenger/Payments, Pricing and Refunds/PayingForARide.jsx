// src/Pages/PayingForARide.jsx
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Paying for a Ride — TabFair",
  description:
    "Learn how to pre‑pay your share for a ride, book via deep link, and get reimbursed.",
  canonical: "https://www.tabfair.com/help/passenger/payment-methods",
  published: "2025-08-17",
  modified: "2025-08-17",
};

export default function PayingForARide() {
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
        title="Paying for a Ride"
        description=""
        breadcrumb={[
          { label: "Help Centre", to: "/help" },
          { label: "Passenger", to: "/help/passenger" },
          { label: "Paying for a Ride" },
        ]}
      >
        <p>
          With TabFair, you pre‑pay your share of the fare in advance. We pool
          the payment, assign a “booker,” and use a deep link to the ride
          provider. After booking, the booker is reimbursed from the pooled
          total.
        </p>

        <h2>How it works</h2>
        <ol>
          <li>Choose your ride and initiate payment via Stripe or PayPal.</li>
          <li>TabFair collects and holds your payment.</li>
          <li>
            We automatically select one passenger as the booker. They're
            redirected to Uber/Bolt to complete the booking via the provided
            deep link.
          </li>
          <li>
            Once the ride is confirmed, we reimburse the booker—so everyone ends
            up paying their share.
          </li>
        </ol>

        <h2>FAQ</h2>
        <ul>
          <li>
            <strong>Will I be charged extra?</strong> No — your payment is just
            your fair share. TabFair doesn't add additional charges.
          </li>
          <li>
            <strong>Can I pay directly in Uber/Bolt?</strong> Currently, all
            payments must be pre‑paid through TabFair.
          </li>
        </ul>

        <p>
          Having issues? Visit our <Link to="/help">Help Centre</Link> for more
          support.
        </p>
      </HelpArticleLayout>
    </>
  );
}
