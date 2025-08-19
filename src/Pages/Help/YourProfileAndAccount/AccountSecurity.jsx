import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import HelpArticleLayout from "../HelpArticleLayout";

const page = {
  title: "Account Security — TabFair",
  description: "Learn how to keep your ShareRide account safe and secure.",
  canonical: "https://www.tabfair.com/help/account/security",
  published: "2025-08-19",
  modified: "2025-08-19",
};

export default function AccountSecurityHelp() {
  const breadcrumbItems = [
    { label: "Help", to: "/help" },
    { label: "Account", to: "/help/account" },
    { label: "Account Security" },
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
        title="Account Security"
        description="Learn how to keep your ShareRide account safe and secure."
        breadcrumb={breadcrumbItems}
      >
        <h2>I think my account has been compromised</h2>
        <p>If you believe someone accessed your account without permission:</p>
        <ul>
          <li>
            <strong>Change your password</strong> immediately.
          </li>
          <li>Check your ride history for any unfamiliar activity.</li>
          <li>Log out of all other devices via Account Settings.</li>
          <li>
            Contact <Link to="/help/contact">Support</Link> so we can help
            secure your account.
          </li>
        </ul>

        <h2>Creating a strong password</h2>
        <p>
          A strong password is your first line of defense. Your password should:
        </p>
        <ul>
          <li>Be at least 8 characters long</li>
          <li>Include uppercase, lowercase, numbers, and symbols</li>
          <li>Avoid common phrases like “password123” or your name</li>
        </ul>

        <h2>Why an email address is required</h2>
        <p>We use your email to:</p>
        <ul>
          <li>Send you ride confirmations and payment receipts</li>
          <li>Verify your identity for password resets</li>
          <li>Contact you in case of emergencies or account issues</li>
        </ul>

        <h2>Reporting Suspicious Activity</h2>
        <p>
          If you notice anything unusual — such as unauthorized logins, messages
          from unknown users, or changes to your account details — please report
          it right away.
        </p>
        <p>To report suspicious activity:</p>
        <ol>
          <li>
            Go to the <Link to="/help/contact">Contact Support</Link> page.
          </li>
          <li>
            Select <strong>“Report suspicious activity”</strong> from the
            dropdown.
          </li>
          <li>
            Include as much detail as possible (date, time, what you noticed).
          </li>
        </ol>
        <p>
          Our team takes all reports seriously and will follow up with any
          necessary actions to secure your account.
        </p>

        <h2>How we protect your data</h2>
        <p>
          ShareRide uses industry-standard encryption to protect all user data.
          We never share your personal information without your consent, and
          access to your data is restricted to authorized personnel only.
        </p>
        <p>
          Learn more in our <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </HelpArticleLayout>
    </>
  );
}
