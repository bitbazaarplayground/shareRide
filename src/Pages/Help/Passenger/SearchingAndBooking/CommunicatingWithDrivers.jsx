// src/Pages/CommunicatingWithDrivers.jsx
import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../../HelpArticleLayout";

const page = {
  title: "Communicating with Drivers — TabFair",
  description:
    "How to reach out and coordinate with your ride partners or drivers.",
  canonical: "https://www.tabfair.com/help/passenger/communicating-drivers",
  published: "2025-08-17",
  modified: "2025-08-17",
};

export default function CommunicatingWithDrivers() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Passenger", to: "/help/passenger" },
    { label: "Communicating with Drivers" },
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
        title="Communicating with Drivers"
        description="How to reach out and coordinate with your ride partners or drivers."
        breadcrumb={breadcrumb}
      >
        <p>
          On Tabfair, once a ride is confirmed, you can message your ride
          partner directly through the platform’s messaging feature.
        </p>

        <ul>
          <li>
            Go to <strong>My Rides &gt; Upcoming Rides</strong>
          </li>
          <li>
            Select the ride and click <strong>"Message"</strong> to start
            chatting
          </li>
          <li>You can share your live location if needed</li>
          <li>
            Use messages to confirm meeting points, estimated arrival times, or
            special requests
          </li>
        </ul>

        <p>
          Messaging may not always be available before a ride is confirmed.
          Typically, you'll be able to message once your ride is booked and
          within a short window before departure.
        </p>

        <p>
          Communication is essential for smooth coordination, especially when
          using third-party taxis.
        </p>
      </HelpArticleLayout>
    </>
  );
}
