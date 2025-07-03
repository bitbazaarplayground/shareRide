import React from "react";
import { Link } from "react-router-dom";
import "./Footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <h2>GoDutch</h2>
          <p>Smart, social and affordable airport rides in the UK.</p>
        </div>

        <div className="footer-links">
          <h4>Explore</h4>
          <ul>
            <li>
              <Link to="/all-rides">Find a Ride</Link>
            </li>
            <li>
              <Link to="/post-ride">Post a Ride</Link>
            </li>
            <li>
              <Link to="/signup">Sign Up</Link>
            </li>
            <li>
              <Link to="/login">Login</Link>
            </li>
          </ul>
        </div>

        <div className="footer-legal">
          <h4>Legal</h4>
          <ul>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
            <li>
              <Link to="/terms">Terms of Use</Link>
            </li>
          </ul>
        </div>

        <div className="footer-contact">
          <h4>Contact</h4>
          <ul>
            <li>Email: support@godutch.com</li>
            <li>Phone: +44 1234 567890</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} GoDutch. All rights reserved.</p>
      </div>
    </footer>
  );
}
