import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import HelpArticleLayout from "../HelpArticleLayout";

const page = {
  title: "Troubleshooting Login — TabFair",
  description: "Having trouble logging in? Let’s fix that.",
  canonical: "https://www.tabfair.com/help/account/troubleshooting-login",
  published: "2025-08-19",
  modified: "2025-08-19",
};

export default function LoginTroubleshooting() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Troubleshooting Login" },
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
        title="Troubleshooting Login"
        description="Having trouble logging in? Let’s fix that."
        breadcrumb={breadcrumbItems}
      >
        <h2>Forgot your password?</h2>
        <p>
          Go to the <Link to="/login">login page</Link> and click{" "}
          <strong>"Forgot Password"</strong>. Follow the instructions in your
          email to reset your password.
        </p>

        <h2>Didn't receive the reset email?</h2>
        <ul>
          <li>Check your spam/junk folder.</li>
          <li>Make sure you entered the correct email address.</li>
          <li>
            Still no luck? <Link to="/help/contact">Contact support</Link>.
          </li>
        </ul>

        <h2>Other Issues</h2>
        <p>
          If you're experiencing issues with social login (e.g., Google), try
          logging in with another method or clearing your browser cache.
        </p>
      </HelpArticleLayout>
    </>
  );
}
