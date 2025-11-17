import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../HelpArticleLayout";

const page = {
  title: "Creating an Account — TabFair",
  description: "Learn how to get started with your ShareRide profile.",
  canonical: "https://www.tabfair.com/help/account/creating-account",
  published: "2025-08-19",
  modified: "2025-08-19",
};

export default function CreatingAccount() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Creating an Account" },
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
        title="Creating an Account"
        description="Learn how to get started with your ShareRide profile."
        breadcrumb={breadcrumb}
      >
        <ol>
          <li>
            Go to the <a href="/register">registration page</a>.
          </li>
          <li>Fill in your name, email, and create a password.</li>
          <li>Click "Sign Up" and check your email for a verification link.</li>
          <li>Once verified, you can log in and complete your profile.</li>
        </ol>
        <p>
          Need help? <a href="/contact-support">Contact support</a>.
        </p>
      </HelpArticleLayout>
    </>
  );
}
