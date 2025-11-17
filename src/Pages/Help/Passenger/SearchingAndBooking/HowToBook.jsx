// src/Pages/HowToBook.jsx
import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "How to Book — TabFair",
  description: "Steps to book a ride through TabFair and what happens next.",
  canonical: "https://www.tabfair.com/help/passenger/how-to-book",
  published: "2025-08-17",
  modified: "2025-08-17",
};

export default function HowToBook() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "How to Book" },
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
        title="How to Book"
        description="Steps to book a ride through TabFair and what happens next."
        breadcrumb={breadcrumb}
      >
        <ol>
          <li>
            Find a ride that fits your location, time, and space needs.
            <br />
            <em>
              You can also message the ride creator with any questions before
              requesting to join.
            </em>
          </li>
          <li>
            Click <strong>“Book”</strong> — your booking is automatically
            submitted.
          </li>
          <li>
            The ride creator (host) has up to <strong>10 minutes</strong> to
            reject your request.
          </li>
          <li>
            If accepted, you'll see confirmation in <strong>My Rides</strong>.
          </li>
          <li>
            If denied, you can either:
            <ul>
              <li>Join another ride</li>
              <li>Or post your own ride to attract co-passengers</li>
            </ul>
          </li>
        </ol>
      </HelpArticleLayout>
    </>
  );
}
