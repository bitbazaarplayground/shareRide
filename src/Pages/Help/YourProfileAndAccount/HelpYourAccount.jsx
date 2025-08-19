import { Helmet } from "react-helmet-async";
import HelpArticleLayout from "../HelpArticleLayout";
import "./SylesHelp/HelpYourAccount.css"; // keeping your import path as-is

const page = {
  title: "Your Profile and Account — TabFair",
  description:
    "Common issues and guidance for creating and accessing your account.",
  canonical: "https://www.tabfair.com/help/account",
  published: "2025-08-19",
  modified: "2025-08-19",
};

export default function HelpYourAccount() {
  const breadcrumb = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
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
        title="Your Profile and Account"
        description="Common issues and guidance for creating and accessing your account."
        breadcrumb={breadcrumb}
      >
        <section className="help-section">
          <h2 className="help-subheading">Creating an Account</h2>
          <p>
            If you're having trouble signing up or logging in, the following
            reasons might apply:
          </p>

          <ul className="help-list">
            <li>
              <strong>You closed your account due to negative ratings</strong>
              <br />
              Re-registration with the same email or number may be blocked.
              Contact us to reactivate it—your negative ratings will remain.
            </li>

            <li>
              <strong>You already have an account</strong>
              <br />
              Try logging in using the same email. Forgot your password? Use the
              reset option.
            </li>

            <li>
              <strong>You signed up using Facebook</strong>
              <br />
              If you created an account with Facebook, log in that way. Creating
              a password will unlink Facebook access.
            </li>

            <li>
              <strong>You reset your password but still can’t log in</strong>
              <br />
              Reinstall the app or enable cookies. You can also try using
              incognito mode or a different browser.
            </li>

            <li>
              <strong>You’re on the wrong page</strong>
              <br />
              Use the blue avatar on the top-right of the homepage to select
              either "Sign up" or "Log in".
            </li>
          </ul>

          <p className="help-contact">
            Still no luck? <a href="/contact">Contact us</a> with details about
            your issue.
          </p>
        </section>
      </HelpArticleLayout>
    </>
  );
}
