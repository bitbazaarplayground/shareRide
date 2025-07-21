import React from "react";
import { Link } from "react-router-dom";
import "./StylesPages/TermsOfUse.css";

const TermsOfUse = () => {
  return (
    <div className="terms-container">
      <h1>Terms and Conditions</h1>
      <p className="effective-date">Effective Date: 3rd of June 2025</p>
      <p className="platform-info">
        Platform Name: <strong>Tabfair</strong>
        <br />
        Company Name: <strong>Tabfair Ltd</strong>
        <br />
        Jurisdiction: <strong>United Kingdom</strong>
      </p>

      <section>
        <h2>1. Definitions</h2>
        <ul>
          <li>
            <strong>User</strong>: Any individual who accesses or uses the
            Tabfair platform.
          </li>
          <li>
            <strong>Platform</strong>: The Tabfair website, mobile app, or
            services provided.
          </li>
          <li>
            <strong>Booking</strong>: A coordinated arrangement between users to
            share a taxi ride.
          </li>
          <li>
            <strong>Service</strong>: The Tabfair platform and all features
            provided.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Acceptance of Terms</h2>
        <p>
          By accessing or using our platform, you agree to be bound by these
          Terms of Use, our <Link to="/privacy">Privacy Policy</Link>, and our{" "}
          <Link to="/cookies">Cookies Policy</Link> Policy. If you do not agree,
          do not use the Service.
        </p>
      </section>

      <section>
        <h2>3. Service Overview</h2>
        <p>Tabfair enables users to:</p>
        <ul>
          <li>Post or view arrival times and destinations</li>
          <li>Match with others to share a taxi</li>
          <li>Coordinate travel together</li>
          <li>Pay in advance for a shared fare</li>
          <li>Be refunded or charged based on attendance verification</li>
        </ul>
        <p>
          Tabfair does not operate transportation services. We facilitate
          coordination and secure payment between users. Some content may be
          illustrative, including AI-generated visuals.
        </p>
      </section>

      <section>
        <h2>4. Eligibility</h2>
        <ul>
          <li>You must be at least 18 years old.</li>
          <li>You must provide accurate, complete information.</li>
          <li>You must comply with all applicable laws.</li>
        </ul>
      </section>

      <section>
        <h2>5. User Responsibilities</h2>
        <ul>
          <li>Arrive at the meeting point on time and act respectfully.</li>
          <li>Do not use the Service for illegal or harmful activities.</li>
          <li>You are responsible for your interactions and conduct.</li>
        </ul>
      </section>

      <section>
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

      <section>
        <h2>7. Acceptable Use Policy</h2>
        <ul>
          <li>Use bots, scripts, or data scrapers</li>
          <li>Reverse-engineer or tamper with the platform</li>
          <li>Harass, threaten, or impersonate others</li>
          <li>Upload or share unlawful, harmful, or misleading content</li>
        </ul>
      </section>

      <section>
        <h2>8. Payments, Fees, and Refunds</h2>
        <h3>8.1 Prepayment</h3>
        <p>
          Users agree to prepay their share of the fare. Funds may be held in
          escrow until ride completion.
        </p>

        <h3>8.2 Platform Fee</h3>
        <p>
          A flat, non-refundable service fee is applied per booking, unless due
          to a system error.
        </p>

        <h3>8.3 No-show and Refund Policy</h3>
        <ul>
          <li>If both users check in, the payment is processed normally.</li>
          <li>
            If one user is absent, the present user may receive a partial
            refund.
          </li>
          <li>
            Tabfair reserves the right to evaluate disputes and enforce
            penalties.
          </li>
        </ul>
      </section>

      <section>
        <h2>9. Verification and Check-in</h2>
        <p>Verification methods may include:</p>
        <ul>
          <li>GPS check-in</li>
          <li>QR code scanning</li>
          <li>Match PINs</li>
          <li>User confirmations</li>
        </ul>
        <p>
          Users must cooperate with verification and not falsify attendance.
        </p>
      </section>

      <section>
        <h2>10. Account Suspension or Termination</h2>
        <ul>
          <li>Suspend or terminate accounts violating these Terms</li>
          <li>Withhold refunds in cases of abuse</li>
          <li>Block users who pose a safety risk or act fraudulently</li>
        </ul>
      </section>

      <section>
        <h2>11. Use of AI and Simulated Content</h2>
        <p>
          Some elements on Tabfair (e.g., images, listings) may use AI or
          simulated content for clarity or user experience. These do not
          represent real people or events unless clearly stated.
        </p>
      </section>

      <section>
        <h2>12. Third-Party Services</h2>
        <p>
          Tabfair may rely on third-party services (e.g., Stripe, Google Maps).
          We are not responsible for availability, failures, or actions by
          third-party providers.
        </p>
      </section>

      <section>
        <h2>13. Dispute Resolution</h2>
        <p>
          We encourage users to resolve disputes between themselves when
          possible. Tabfair may intervene at our discretion. Unresolved disputes
          may be referred to small claims court in London, UK.
        </p>
      </section>

      <section>
        <h2>14. Indemnification</h2>
        <p>
          You agree to indemnify and hold Tabfair Ltd harmless from any claims
          or damages resulting from your misuse of the Service.
        </p>
      </section>

      <section>
        <h2>15. Limitation of Liability</h2>
        <p>Tabfair Ltd is not liable for:</p>
        <ul>
          <li>Missed rides, lost earnings, or delays</li>
          <li>Injuries, disputes, or misconduct by users</li>
          <li>System downtime or third-party failures</li>
        </ul>
      </section>

      <section>
        <h2>16. Intellectual Property</h2>
        <p>
          All platform content (text, images, code, branding) is the property of
          Tabfair Ltd unless otherwise stated. You may not copy or redistribute
          without written permission.
        </p>
      </section>

      <section>
        <h2>17. Privacy Policy</h2>
        <p>
          Your use of Tabfair is subject to our{" "}
          <Link to="#privacy-policy">Privacy Policy</Link>, which describes how
          we collect, use, and protect your personal data.
        </p>
      </section>

      <section>
        <h2>18. Cookies Policy</h2>
        <p>
          Tabfair uses cookies to personalize your experience. You can manage
          your preferences in your browser or read our{" "}
          <Link to="#cookies-policy">Cookies Policy</Link> for details.
        </p>
      </section>

      <section>
        <h2>19. Modifications</h2>
        <p>
          We may update these Terms at any time. Your continued use of the
          platform indicates your acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2>20. Governing Law</h2>
        <p>
          These Terms are governed by the laws of England and Wales. Legal
          disputes will be handled in London courts.
        </p>
      </section>

      <section>
        <h2>21. Contact Us</h2>
        <p>
          📧 <a href="mailto:Hello@tabfair.com">Hello@tabfair.com</a>
          <br />
          🏢 Tabfair Ltd, UK (full address to be provided)
        </p>
      </section>
    </div>
  );
};

export default TermsOfUse;
