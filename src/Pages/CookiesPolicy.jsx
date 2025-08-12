// src/Pages/CookiesPolicy.jsx
import { Helmet } from "react-helmet-async";
import "./StylesPages/TermsOfUse.css";

export default function CookiesPolicy() {
  return (
    <div className="terms-container">
      <Helmet>
        <title>Cookies Policy — TabFair</title>
        <meta
          name="description"
          content="How TabFair uses cookies to improve your experience, including essential, performance, and preference cookies."
        />
        <link
          rel="canonical"
          href="https://jade-rolypoly-5d4274.netlify.app/cookies"
        />
        <meta property="og:type" content="article" />
        <meta property="og:title" content="Cookies Policy — TabFair" />
        <meta
          property="og:description"
          content="Learn about the cookies TabFair uses and how you can manage them in your browser."
        />
        <meta
          property="og:image"
          content="https://jade-rolypoly-5d4274.netlify.app/og-image.jpg"
        />
      </Helmet>

      <h1>Cookies Policy</h1>
      <p className="effective-date">Effective Date: 3 June 2025</p>

      <section id="what-are-cookies">
        <h2>What Are Cookies?</h2>
        <p>
          Cookies are small text files stored on your device when you visit our
          platform. They help us enhance your experience by remembering your
          preferences and enabling core features.
        </p>
      </section>

      <section id="types-we-use">
        <h2>Types of Cookies We Use</h2>
        <ul>
          <li>
            <strong>Essential cookies</strong> — Required for login, session
            tracking, and secure navigation.
          </li>
          <li>
            <strong>Performance cookies</strong> — Help us understand how our
            platform is used (e.g., analytics).
          </li>
          <li>
            <strong>Preference cookies</strong> — Store settings like language
            and theme.
          </li>
        </ul>
      </section>

      <section id="managing-cookies">
        <h2>Managing Cookies</h2>
        <p>
          You can accept, decline, or delete cookies through your browser
          settings. Please note that disabling certain cookies may affect site
          functionality.
        </p>
      </section>

      <section id="third-party-cookies">
        <h2>Third-Party Cookies</h2>
        <p>
          Some cookies may be placed by third-party services integrated with our
          platform. These are governed by the respective third party’s cookie
          and privacy policies.
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
