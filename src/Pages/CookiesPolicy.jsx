import React from "react";
import "./StylesPages/TermsOfUse.css";

const CookiesPolicy = () => {
  return (
    <div className="terms-container">
      <h1>Cookies Policy</h1>
      <p className="effective-date">Effective Date: 3rd of June 2025</p>

      <section>
        <h2>What Are Cookies?</h2>
        <p>
          Cookies are small text files stored on your device when you visit our
          platform. They help us enhance your experience.
        </p>
      </section>

      <section>
        <h2>Types We Use</h2>
        <ul>
          <li>Essential cookies (login, session tracking)</li>
          <li>Performance cookies (analytics)</li>
          <li>Preference cookies (language, theme)</li>
        </ul>
      </section>

      <section>
        <h2>Managing Cookies</h2>
        <p>
          You can accept, decline, or delete cookies through your browser
          settings.
        </p>
      </section>
      <section>
        <h2>Third-Party Cookies</h2>
        <p>
          Some cookies may be placed by third-party services integrated with our
          platform. These are governed by the respective third-party’s cookie
          and privacy policies.
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

export default CookiesPolicy;
