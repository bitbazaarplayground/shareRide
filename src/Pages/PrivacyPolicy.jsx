import React from "react";
import "./StylesPages/TermsOfUse.css";

const PrivacyPolicy = () => {
  return (
    <div className="terms-container">
      <h1>Privacy Policy</h1>
      <p className="effective-date">Effective Date: 3rd of June 2025</p>

      <section>
        <h2>1. What We Collect</h2>
        <ul>
          <li>Name, email, and profile info</li>
          <li>Location data (for ride check-in)</li>
          <li>Payment and booking activity</li>
        </ul>
      </section>

      <section>
        <h2>2. Why We Collect It</h2>
        <ul>
          <li>To match users for ride-sharing</li>
          <li>To process payments and manage disputes</li>
          <li>To verify attendance and provide safety features</li>
        </ul>
      </section>

      <section>
        <h2>3. How We Store Data</h2>
        <ul>
          <li>Data is stored securely on encrypted servers</li>
          <li>Access is limited to authorized staff only</li>
        </ul>
      </section>

      <section>
        <h2>4. Data Sharing</h2>
        <ul>
          <li>We never sell your data</li>
          <li>
            We may share data with payment or verification providers only when
            necessary
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Your Rights</h2>
        <ul>
          <li>You may access or delete your data at any time</li>
          <li>You may opt out of marketing emails</li>
        </ul>
      </section>
      <section>
        <h2>6. Third-Party Services</h2>
        <p>
          We may share your data with trusted third-party partners that help us
          provide core features of our platform, such as payment processing
          (e.g., Stripe) or location services (e.g., Google Maps).
        </p>
        <p>
          Once shared, your data will be subject to the privacy policies of
          these third-party providers. We are not responsible for how these
          external platforms collect, use, or protect your data. We recommend
          reviewing their privacy policies directly.
        </p>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>
          📧 <a href="mailto:Hello@tabfair.com">Hello@tabfair.com</a>
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
