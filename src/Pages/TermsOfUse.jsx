// src/Pages/TermsOfUse.jsx
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import OnThisPageSelect from "../Components/OnThisPageSelect";
import "./StylesPages/CookiesPolicy.css";

export default function TermsOfUse() {
  const page = {
    title: "Terms and Conditions — TabFair",
    description:
      "The rules and policies for using TabFair, including eligibility, payments, acceptable use, and dispute resolution.",
    canonical: "https://jade-rolypoly-5d4274.netlify.app/terms",
    ogImage: "https://jade-rolypoly-5d4274.netlify.app/og-image.jpg",
    published: "2025-06-03",
    modified: "2025-06-03",
    path: "/terms",
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://jade-rolypoly-5d4274.netlify.app/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Terms and Conditions",
        item: page.canonical,
      },
    ],
  };

  const webPageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Terms and Conditions — TabFair",
    description: page.description,
    url: page.canonical,
    inLanguage: "en-GB",
    datePublished: page.published,
    dateModified: page.modified,
    isPartOf: {
      "@type": "WebSite",
      name: "TabFair",
      url: "https://jade-rolypoly-5d4274.netlify.app/",
    },
  };

  return (
    <main id="main-content" className="policy-page" role="main">
      <Helmet>
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={page.canonical} />
        <meta
          name="robots"
          content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1"
        />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="TabFair" />
        <meta property="og:locale" content="en_GB" />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.description} />
        <meta property="og:url" content={page.canonical} />
        <meta property="og:image" content={page.ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={page.title} />
        <meta name="twitter:description" content={page.description} />
        <meta name="twitter:image" content={page.ogImage} />
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbLd)}
        </script>
        <script type="application/ld+json">{JSON.stringify(webPageLd)}</script>
      </Helmet>

      <header className="policy-header">
        <p className="breadcrumbs" aria-label="Breadcrumb">
          <span>
            <Link to="/">Home</Link>
          </span>{" "}
          <span aria-hidden="true">/</span> <span>Terms and Conditions</span>
        </p>
        <h1>Terms and Conditions</h1>
        <p className="effective-date">
          Effective date: <time dateTime={page.published}>3 June 2025</time>
        </p>
        <p className="platform-info" aria-describedby="jurisdiction-note">
          Platform Name: <strong>TabFair</strong>
          <br />
          Company Name: <strong>TabFair Ltd</strong>
          <br />
          Jurisdiction: <strong>United Kingdom</strong>
        </p>
        <small id="jurisdiction-note" className="sr-only">
          These terms are governed by England and Wales.
        </small>

        {/* 👇 Replace the big list TOC with the compact dropdown */}
        <OnThisPageSelect label="On this page" sticky />
      </header>

      {/* …keep all your <section id="..."><h2>…</h2>…</section> content as-is… */}
      {/* sections left unchanged below */}
      <section id="definitions">
        <h2>1. Definitions</h2>
        <ul>
          <li>
            <strong>User</strong>: Any individual who accesses or uses the
            TabFair platform.
          </li>
          <li>
            <strong>Platform</strong>: The TabFair website, mobile app, or
            services provided.
          </li>
          <li>
            <strong>Booking</strong>: A coordinated arrangement between users to
            share a taxi ride.
          </li>
          <li>
            <strong>Service</strong>: The TabFair platform and all features
            provided.
          </li>
        </ul>
      </section>

      <section id="acceptance">
        <h2>2. Acceptance of Terms</h2>
        <p>
          By accessing or using our platform, you agree to be bound by these
          Terms of Use, our{" "}
          <Link to="/privacy" aria-label="Privacy Policy page">
            Privacy Policy
          </Link>
          , and our{" "}
          <Link to="/cookies" aria-label="Cookies Policy page">
            Cookies Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>
      </section>

      <section id="overview">
        <h2>3. Service Overview</h2>
        <p>TabFair enables users to:</p>
        <ul>
          <li>Post or view arrival times and destinations</li>
          <li>Match with others to share a taxi</li>
          <li>Coordinate travel together</li>
          <li>Pay in advance for a shared fare</li>
          <li>Be refunded or charged based on attendance verification</li>
        </ul>
        <p>
          TabFair does not operate transportation services. We facilitate
          coordination and secure payment between users. Some content may be
          illustrative, including AI‑generated visuals.
        </p>
      </section>

      <section id="eligibility">
        <h2>4. Eligibility</h2>
        <ul>
          <li>You must be at least 18 years old.</li>
          <li>You must provide accurate, complete information.</li>
          <li>You must comply with all applicable laws.</li>
        </ul>
      </section>

      <section id="responsibilities">
        <h2>5. User Responsibilities</h2>
        <ul>
          <li>Arrive at the meeting point on time and act respectfully.</li>
          <li>Do not use the Service for illegal or harmful activities.</li>
          <li>You are responsible for your interactions and conduct.</li>
        </ul>
      </section>

      <section id="accounts">
        <h2>6. User Accounts and Security</h2>
        <ul>
          <li>You must create an account to use the platform fully.</li>
          <li>
            You are responsible for maintaining the confidentiality of your
            account and password.
          </li>
          <li>
            Notify us immediately of any unauthorized use of your account.
          </li>
        </ul>
      </section>

      <section id="acceptable-use">
        <h2>7. Acceptable Use Policy</h2>
        <ul>
          <li>Do not use bots, scripts, or data scrapers.</li>
          <li>Do not reverse‑engineer or tamper with the platform.</li>
          <li>Do not harass, threaten, or impersonate others.</li>
          <li>
            Do not upload or share unlawful, harmful, or misleading content.
          </li>
        </ul>
      </section>

      <section id="payments">
        <h2>8. Payments, Fees, and Refunds</h2>
        <h3>8.1 Prepayment</h3>
        <p>
          Users agree to prepay their share of the fare. Funds may be held in
          escrow until ride completion.
        </p>
        <h3>8.2 Platform Fee</h3>
        <p>
          A flat, non‑refundable service fee is applied per booking, unless due
          to a system error.
        </p>
        <h3>8.3 No‑show and Refund Policy</h3>
        <ul>
          <li>If both users check in, the payment is processed normally.</li>
          <li>
            If one user is absent, the present user may receive a partial
            refund.
          </li>
          <li>TabFair may evaluate disputes and enforce penalties.</li>
        </ul>
      </section>

      <section id="verification">
        <h2>9. Verification and Check‑in</h2>
        <p>Verification methods may include:</p>
        <ul>
          <li>GPS check‑in</li>
          <li>QR code scanning</li>
          <li>Match PINs</li>
          <li>User confirmations</li>
        </ul>
      </section>

      <section id="suspension">
        <h2>10. Account Suspension or Termination</h2>
        <ul>
          <li>Suspension or termination for violations of these Terms.</li>
          <li>Withholding refunds in cases of abuse.</li>
          <li>Blocking users who pose a safety risk or act fraudulently.</li>
        </ul>
      </section>

      <section id="ai">
        <h2>11. Use of AI and Simulated Content</h2>
        <p>
          Some elements on TabFair (e.g., images, listings) may use AI or
          simulated content for clarity or user experience. These do not
          represent real people or events unless clearly stated.
        </p>
      </section>

      <section id="third-party">
        <h2>12. Third‑Party Services</h2>
        <p>
          TabFair may rely on third‑party services (e.g., Stripe, Google Maps).
          We are not responsible for availability, failures, or actions by
          third‑party providers.
        </p>
      </section>

      <section id="disputes">
        <h2>13. Dispute Resolution</h2>
        <p>
          We encourage users to resolve disputes between themselves when
          possible. Unresolved disputes may be referred to small claims court in
          London, UK.
        </p>
      </section>

      <section id="indemnification">
        <h2>14. Indemnification</h2>
        <p>
          You agree to indemnify and hold TabFair Ltd harmless from any claims
          or damages resulting from your misuse of the Service.
        </p>
      </section>

      <section id="liability">
        <h2>15. Limitation of Liability</h2>
        <p>TabFair Ltd is not liable for:</p>
        <ul>
          <li>Missed rides, lost earnings, or delays</li>
          <li>Injuries, disputes, or misconduct by users</li>
          <li>System downtime or third‑party failures</li>
        </ul>
      </section>

      <section id="ip">
        <h2>16. Intellectual Property</h2>
        <p>
          All platform content (text, images, code, branding) is the property of
          TabFair Ltd unless otherwise stated. You may not copy or redistribute
          without written permission.
        </p>
      </section>

      <section id="privacy-link">
        <h2>17. Privacy Policy</h2>
        <p>
          Your use of TabFair is subject to our{" "}
          <Link to="/privacy">Privacy Policy</Link>, which describes how we
          collect, use, and protect your personal data.
        </p>
      </section>

      <section id="cookies-link">
        <h2>18. Cookies Policy</h2>
        <p>
          TabFair uses cookies to personalise your experience. You can manage
          your preferences in your browser or read our{" "}
          <Link to="/cookies">Cookies Policy</Link> for details.
        </p>
      </section>

      <section id="modifications">
        <h2>19. Modifications</h2>
        <p>
          We may update these Terms at any time. Your continued use of the
          platform indicates your acceptance of the revised Terms.
        </p>
      </section>

      <section id="law">
        <h2>20. Governing Law</h2>
        <p>
          These Terms are governed by the laws of England and Wales. Legal
          disputes will be handled in London courts.
        </p>
      </section>

      <section id="contact">
        <h2>21. Contact Us</h2>
        <address className="contact-block">
          <span aria-hidden="true">📧</span>{" "}
          <a href="mailto:hello@tabfair.com">hello@tabfair.com</a>
          <br />
          <span aria-hidden="true">🏢</span> TabFair Ltd, UK (full address to be
          provided)
        </address>
      </section>
    </main>
  );
}
