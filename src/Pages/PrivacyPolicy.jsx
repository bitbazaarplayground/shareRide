// src/Pages/PrivacyPolicy.jsx
import { Helmet } from "react-helmet-async";
import "./StylesPages/TermsOfUse.css";

export default function PrivacyPolicy() {
  return (
    <div className="terms-container">
      <Helmet>
        <title>Privacy Policy — TabFair</title>
        <meta
          name="description"
          content="How TabFair collects, uses, and protects your data, including account info, location, and payments."
        />
        <link
          rel="canonical"
          href="https://jade-rolypoly-5d4274.netlify.app/privacy"
        />
        {/* Nice-to-have OG tags */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content="Privacy Policy — TabFair" />
        <meta
          property="og:description"
          content="Learn how TabFair handles your personal data and privacy rights."
        />
        <meta
          property="og:image"
          content="https://jade-rolypoly-5d4274.netlify.app/og-image.jpg"
        />
      </Helmet>

      <h1>Privacy Policy</h1>
      <p className="effective-date">Effective Date: 3 June 2025</p>

      <section id="what-we-collect">
        <h2>1. What We Collect</h2>
        <ul>
          <li>Name, email, and profile info</li>
          <li>Location data (for ride check-in)</li>
          <li>Payment and booking activity</li>
        </ul>
      </section>

      <section id="why-we-collect">
        <h2>2. Why We Collect It</h2>
        <ul>
          <li>To match users for ride-sharing</li>
          <li>To process payments and manage disputes</li>
          <li>To verify attendance and provide safety features</li>
        </ul>
      </section>

      <section id="storage">
        <h2>3. How We Store Data</h2>
        <ul>
          <li>Data is stored securely on encrypted servers</li>
          <li>Access is limited to authorized staff only</li>
        </ul>
      </section>

      <section id="sharing">
        <h2>4. Data Sharing</h2>
        <ul>
          <li>We never sell your data</li>
          <li>
            We may share data with payment or verification providers only when
            necessary
          </li>
        </ul>
      </section>

      <section id="your-rights">
        <h2>5. Your Rights</h2>
        <ul>
          <li>You may access or delete your data at any time</li>
          <li>You may opt out of marketing emails</li>
        </ul>
      </section>

      <section id="third-parties">
        <h2>6. Third-Party Services</h2>
        <p>
          We may share your data with trusted third-party partners that help us
          provide core features of our platform, such as payment processing
          (e.g., Stripe) or location services (e.g., Google Maps).
        </p>
        <p>
          Once shared, your data will be subject to the privacy policies of
          these third-party providers. We recommend reviewing their privacy
          policies directly.
        </p>
      </section>

      <section id="contact">
        <h2>Contact Us</h2>
        <p>
          📧 <a href="mailto:Hello@tabfair.com">Hello@tabfair.com</a>
        </p>
      </section>
    </div>
  );
}
