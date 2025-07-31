import React from "react";
import { Link } from "react-router-dom";
import "./StylesHelp/Help.css";

export default function HelpPage() {
  return (
    <div className="help-wrapper">
      {/* Top Header */}
      <header className="help-header">
        <h1>How can we help?</h1>
        <div className="search-box">
          <input type="text" placeholder="Search help articles" />
          <button aria-label="Search">🔍</button>
        </div>
      </header>

      {/* Help Category Cards */}
      <section className="help-cards">
        <Link to="/help/passenger" className="help-card">
          <img src="/images/help/passenger.png" alt="Passenger" />
          <span>Passenger</span>
        </Link>
        <Link to="/help/driver" className="help-card">
          <img src="/images/help/driver.png" alt="Driver" />
          <span>Driver</span>
        </Link>
        <Link to="/help/account" className="help-card">
          <img src="/images/help/account.png" alt="Your Profile and Account" />
          <span>Your Profile & Account</span>
        </Link>
        <Link to="/help/safety" className="help-card">
          <img src="/images/help/safety.png" alt="Trust and Safety" />
          <span>Trust, Safety & Accessibility</span>
        </Link>
        <Link to="/help/about" className="help-card">
          <img src="/images/help/about.png" alt="About App" />
          <span>About ShareRide</span>
        </Link>
      </section>

      {/* Article Sections */}
      <section className="articles-section">
        <div className="articles-box">
          <h2>Top Articles</h2>
          <ul>
            <li>
              <Link to="/help/rating-driver">Rating your carpool driver</Link>
            </li>
            <li>
              <Link to="/help/passenger-cancellation">
                Passenger cancellation rate
              </Link>
            </li>
          </ul>
        </div>

        <div className="articles-box">
          <h2>Suggested Articles</h2>
          <ul>
            <li>
              <Link to="/help/luggage-policy">Bus Luggage Policy</Link>
            </li>
            <li>
              <Link to="/help/booking">Booking a bus online</Link>
            </li>
            <li>
              <Link to="/help/bus-cancellation">Bus Cancellation Policy</Link>
            </li>
            <li>
              <Link to="/help/cancel-booking">Cancelling your bus booking</Link>
            </li>
            <li>
              <Link to="/help/offering-ride">Offering a ride</Link>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

// import React from "react";
// import { Link } from "react-router-dom";
// import "./SylesHelp/Help.css";

// export default function HelpPage() {
//   return (
//     <div className="help-container">
//       <h1>Help Center</h1>

//       {/* FAQ Section */}
//       <section id="faq" className="help-section">
//         <h2>Frequently Asked Questions</h2>
//         <div>
//           <div>
//             <strong>How do I reset my password?</strong>
//             <p>
//               Click "Forgot Password" on the login page and follow the
//               instructions in your email.
//             </p>
//           </div>
//           <div>
//             <strong>How can I publish a ride?</strong>
//             <p>
//               Go to the "Publish Ride" tab, fill out the form with your ride
//               details, and click "Publish".
//             </p>
//           </div>
//           <div>
//             <strong>Is payment handled through the app?</strong>
//             <p>
//               Yes. Stripe handles secure payments and receipts are emailed
//               automatically.
//             </p>
//           </div>
//         </div>
//       </section>

//       {/* Getting Started Guide */}
//       <section id="getting-started" className="help-section">
//         <h2>Getting Started</h2>
//         <ol>
//           <li>Register for a free account or sign in.</li>
//           <li>Complete your profile (photo, contact details).</li>
//           <li>Search for rides or post your own.</li>
//           <li>Use the chat to communicate and coordinate.</li>
//         </ol>
//       </section>

//       {/* Contact Support */}
//       <section id="contact" className="help-section">
//         <h2>Contact Support</h2>
//         <div className="contact-info">
//           <p>
//             Need help? Reach out through our support form or email us directly.
//           </p>
//           <p>
//             Email:{" "}
//             <a href="mailto:support@shareride.com">support@shareride.com</a>
//           </p>
//         </div>
//       </section>

//       {/* Safety Tips */}
//       <section id="safety" className="help-section">
//         <h2>Ride Safety Tips</h2>
//         <ul>
//           <li>Always verify driver identity and vehicle details.</li>
//           <li>Share your ride info with a friend or family member.</li>
//           <li>Meet in public, well-lit locations.</li>
//         </ul>
//       </section>

//       {/* Quick Links */}
//       <section id="links" className="help-section">
//         <h2>Quick Links</h2>
//         <div className="quick-links">
//           <Link to="/terms">Terms & Conditions</Link>
//           <Link to="/privacy">Privacy Policy</Link>
//           <Link to="/cookies">Cookies Policy</Link>
//         </div>
//       </section>
//     </div>
//   );
// }
