import React from "react";
import "./StylesPages/TermsOfUse.css";
const TermsOfUse = () => {
  return (
    <div className="terms-container">
      <h1>Terms of Use</h1>
      <p className="effective-date">Effective Date: 3rd of June 2025</p>
      <p className="platform-info">
        Platform Name: <strong>GoDutch</strong>
        <br />
        Company Name: <strong>[GoDutch Ltd]</strong>
        <br />
        Jurisdiction: <strong>United Kingdom</strong>
      </p>

      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using our platform (the “Service”), you agree to be
          bound by these Terms of Use (the “Terms”), our Privacy Policy, and any
          other policies we publish. If you do not agree, do not use the
          Service.
        </p>
      </section>

      <section>
        <h2>2. Service Overview</h2>
        <p>RideShareMatch provides a platform where users can:</p>
        <ul>
          <li>Post or view arrival times and destinations</li>
          <li>Match with others to share a taxi</li>
          <li>Coordinate travel together</li>
          <li>Pay in advance for a shared fare</li>
          <li>Be refunded or charged based on attendance verification</li>
        </ul>
        <p>
          We do not operate taxis or provide transportation services. We only
          facilitate coordination and payment between users.
        </p>
      </section>

      <section>
        <h2>3. Eligibility</h2>
        <ul>
          <li>You must be at least 18 years old.</li>
          <li>You must provide accurate and complete information.</li>
          <li>
            You must not violate any applicable laws when using the service.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. User Responsibilities</h2>
        <ul>
          <li>Arrive at the meeting point on time and act respectfully.</li>
          <li>Do not use the Service for illegal or harmful purposes.</li>
          <li>You are responsible for your interactions and communication.</li>
        </ul>
      </section>

      <section>
        <h2>5. Payments, Fees, and Refunds</h2>

        <h3>5.1 Prepayment</h3>
        <p>
          Users agree to prepay their share of the fare. Funds may be held in
          escrow until both users check in.
        </p>

        <h3>5.2 Platform Fee</h3>
        <p>
          We charge a flat service fee per booking. This is non-refundable
          unless a system error occurs.
        </p>

        <h3>5.3 No-show and Refund Policy</h3>
        <ul>
          <li>If both users verify attendance, payment proceeds as normal.</li>
          <li>
            If one user fails to appear, the present user may receive a partial
            refund, and the no-show may be penalized.
          </li>
          <li>Disputes are handled case-by-case at our discretion.</li>
        </ul>
      </section>

      <section>
        <h2>6. Verification and Check-in</h2>
        <p>We may use:</p>
        <ul>
          <li>GPS location</li>
          <li>QR code scanning</li>
          <li>Match PINs</li>
          <li>User confirmation</li>
        </ul>
        <p>
          You agree to cooperate with the verification process and not attempt
          to cheat or misrepresent another user.
        </p>
      </section>

      <section>
        <h2>7. Account Termination</h2>
        <ul>
          <li>Suspend or terminate accounts for violations of these Terms</li>
          <li>Withhold refunds or charge penalties for abuse or fraud</li>
          <li>Block access to users who create unsafe experiences</li>
        </ul>
      </section>

      <section>
        <h2>8. Disclaimers</h2>
        <p>
          We do not guarantee a ride will take place or that users will honor
          commitments. Use the platform at your own risk.
        </p>
      </section>

      <section>
        <h2>9. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, [Company Name] is not liable
          for:
        </p>
        <ul>
          <li>Loss of earnings, time, or data</li>
          <li>Injuries, disputes, or misbehavior by users</li>
          <li>Taxi fare variations, cancellations, or third-party failures</li>
        </ul>
      </section>

      <section>
        <h2>10. Intellectual Property</h2>
        <p>
          All content, code, logos, and trademarks are property of [Company
          Name] unless otherwise stated. You may not copy or redistribute
          without written permission.
        </p>
      </section>

      <section>
        <h2>11. Privacy</h2>
        <p>
          Our use of your personal data is governed by our Privacy Policy,
          available at{" "}
          <a href="[your-website.com/privacy]">your-website.com/privacy</a>.
        </p>
      </section>

      <section>
        <h2>12. Modifications</h2>
        <p>
          We may update these Terms at any time. Continued use after changes
          means you accept the new Terms.
        </p>
      </section>

      <section>
        <h2>13. Governing Law</h2>
        <p>
          These Terms are governed by the laws of [England and Wales]. Disputes
          will be resolved in the courts of [City, UK].
        </p>
      </section>

      <section>
        <h2>14. Contact Us</h2>
        <p>
          📧{" "}
          <a href="mailto:support@yourwebsite.com">support@yourwebsite.com</a>
          <br />
          🏢 [Your Company Address]
        </p>
      </section>
    </div>
  );
};

export default TermsOfUse;
