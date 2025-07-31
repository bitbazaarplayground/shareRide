import React from "react";
import { Link } from "react-router-dom";
import "./StylesPages/Help.css";

export default function HelpPage() {
  return (
    <div className="help-container p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Help Center</h1>

      {/* FAQ Section */}
      <section id="faq" className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">
          Frequently Asked Questions
        </h2>
        <div className="space-y-3">
          <div>
            <strong>How do I reset my password?</strong>
            <p>
              Click "Forgot Password" on the login page and follow the
              instructions in your email.
            </p>
          </div>
          <div>
            <strong>How can I publish a ride?</strong>
            <p>
              Go to the "Publish Ride" tab, fill out the form with your ride
              details, and click "Publish".
            </p>
          </div>
          <div>
            <strong>Is payment handled through the app?</strong>
            <p>
              Yes. Stripe handles secure payments and receipts are emailed
              automatically.
            </p>
          </div>
        </div>
      </section>

      {/* Getting Started Guide */}
      <section id="getting-started" className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Register for a free account or sign in.</li>
          <li>Complete your profile (photo, contact details).</li>
          <li>Search for rides or post your own.</li>
          <li>Use the chat to communicate and coordinate.</li>
        </ol>
      </section>

      {/* Contact Support */}
      <section id="contact" className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Contact Support</h2>
        <p className="mb-2">
          Need help? Reach out through our support form or email us directly.
        </p>
        <p>
          Email:{" "}
          <a
            href="mailto:support@shareride.com"
            className="text-blue-600 underline"
          >
            support@shareride.com
          </a>
        </p>
      </section>

      {/* Safety Tips */}
      <section id="safety" className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Ride Safety Tips</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Always verify driver identity and vehicle details.</li>
          <li>Share your ride info with a friend or family member.</li>
          <li>Meet in public, well-lit locations.</li>
        </ul>
      </section>

      {/* Quick Links */}
      <section id="links" className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Quick Links</h2>
        <ul className="list-inside space-y-2 text-blue-600 underline">
          <li>
            <Link to="/terms">Terms & Conditions</Link>
          </li>
          <li>
            <Link to="/privacy">Privacy Policy</Link>
          </li>
          <li>
            <Link to="/cookies">Cookies Policy</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
