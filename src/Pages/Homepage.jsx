// src/Pages/Homepage.jsx
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import SavingsCarousel from "../Components/SavingsCarousel";
import Footer from "../Footer/Footer";
import "./StylesPages/Homepage.css";

export default function Homepage() {
  const { i18n } = useTranslation();
  const [showMainText, setShowMainText] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowMainText(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "TabFair",
    url: "https://jade-rolypoly-5d4274.netlify.app/",
    potentialAction: {
      "@type": "SearchAction",
      target:
        "https://jade-rolypoly-5d4274.netlify.app/all-rides?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "TabFair",
    url: "https://jade-rolypoly-5d4274.netlify.app/",
    logo: "https://jade-rolypoly-5d4274.netlify.app/icon-512.png",
    sameAs: [],
  };

  return (
    <>
      <Helmet htmlAttributes={{ lang: i18n.language || "en-GB" }}>
        <title>TabFair — Share the ride. Split the cost.</title>
        <meta
          name="description"
          content="Share taxis, split the fare, and get door-to-door rides across the UK with trusted users."
        />
        <link
          rel="canonical"
          href="https://jade-rolypoly-5d4274.netlify.app/"
        />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TabFair" />
        <meta
          property="og:title"
          content="TabFair — Share the ride. Split the cost."
        />
        <meta
          property="og:description"
          content="Find and share rides from airports and cities in the UK. Save money with trusted users."
        />
        <meta
          property="og:url"
          content="https://jade-rolypoly-5d4274.netlify.app/"
        />
        <meta
          property="og:image"
          content="https://jade-rolypoly-5d4274.netlify.app/og-image.jpg"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="TabFair — Share the ride. Split the cost."
        />
        <meta
          name="twitter:description"
          content="Find and share rides from airports and cities in the UK. Save money with trusted users."
        />
        <meta
          name="twitter:image"
          content="https://jade-rolypoly-5d4274.netlify.app/og-image.jpg"
        />

        {/* JSON-LD */}
        <script type="application/ld+json">
          {JSON.stringify(websiteJsonLd)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(organizationJsonLd)}
        </script>
      </Helmet>

      <main id="main" className="homepage">
        {/* HERO SECTION */}
        <section className="hero-wrapper">
          <picture>
            <source
              type="image/avif"
              srcSet="
      /images/home/carpoolImage-480.avif   480w,
      /images/home/carpoolImage-1024.avif 1024w,
      /images/home/carpoolImage-1600.avif 1600w
    "
              sizes="100vw"
            />
            <source
              type="image/webp"
              srcSet="
      /images/home/carpoolImage-480.webp   480w,
      /images/home/carpoolImage-1024.webp 1024w,
      /images/home/carpoolImage-1600.webp 1600w
    "
              sizes="100vw"
            />
            <img
              src="/images/home/carpoolImage-1600.jpg"
              srcSet="
      /images/home/carpoolImage-480.jpg   480w,
      /images/home/carpoolImage-1024.jpg 1024w,
      /images/home/carpoolImage-1600.jpg 1600w
    "
              sizes="100vw"
              alt="Happy people in a car sharing a ride"
              width="1600"
              height="900"
              loading="eager"
              decoding="async"
              fetchpriority="high"
              className="hero-img"
            />
          </picture>

          <div className="hero-overlay">
            <h1 className="brand-title">
              {showMainText
                ? "Ride together, save together."
                : "Going the same way? Let’s split the ride."}
            </h1>
            <p className="tagline">
              Door-to-door rides across the UK with trusted users.
            </p>
          </div>
        </section>

        {/* TOP WAVE (OUTSIDE HERO WRAPPER) */}
        <div className="orange-bottom-wave">
          <svg
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#e66000"
              d="
              M0,120
              C20,110 1440,260 1640,40
              C640,180 180,90 0,80
              Z"
            />
          </svg>
        </div>

        <SavingsCarousel />

        {/* BENEFITS SECTION */}
        <section className="benefits">
          <h2>Why Share a Taxi?</h2>
          <div className="benefits-grid">
            <div className="benefit-card">
              <h3>💸 Cost-Effective</h3>
              <p>
                Split the fare and save—often cheaper than solo taxi or public
                transit.
              </p>
            </div>
            <div className="benefit-card">
              <h3>🚪 Door-to-Door</h3>
              <p>
                No transfers or extra walking—perfect for luggage or late
                departures.
              </p>
            </div>
            <div className="benefit-card">
              <h3>⏱ Faster Travel</h3>
              <p>Head straight to your destination without stops or waiting.</p>
            </div>
            <div className="benefit-card">
              <h3>😌 Comfortable & Private</h3>
              <p>Enjoy more space, control the ride, and keep it cozy.</p>
            </div>
            <div className="benefit-card">
              <h3>🕓 Flexibly Timed</h3>
              <p>Anytime availability—that works around your schedule.</p>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="features">
          <h2>Why Tabfair?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <h3>🌍 Eco-friendly</h3>
              <p>Reduce emissions by sharing your ride.</p>
            </div>
            <div className="feature-card">
              <h3>🚗 Reliable Rides</h3>
              <p>All users are verified with complete profiles.</p>
            </div>
            <div className="feature-card">
              <h3>💸 Save Money</h3>
              <p>Share fuel costs and make new friends on the road.</p>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="how-it-works">
          <h2>How It Works</h2>
          <div className="steps-grid">
            <div className="step">
              <h4>1. Post a Ride</h4>
              <p>Tell us where you're going and when.</p>
            </div>
            <div className="step">
              <h4>2. Find Matches</h4>
              <p>Search or browse rides offered by others.</p>
            </div>
            <div className="step">
              <h4>3. Travel Together</h4>
              <p>Connect, travel and split the costs.</p>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="testimonials">
          <h2>What Our Users Say</h2>
          <div className="testimonial-grid">
            <div className="testimonial-card">
              <img
                src="/images/testimonial3.png"
                alt="User avatar"
                className="testimonial-avatar"
              />
              <blockquote>
                “We had just landed from Mexico and dreaded the long trip to
                Chelmsford. Then we found Tabfair. Shared a taxi from Heathrow
                and ended up saving money — plus, we had great company the whole
                way!”
                <footer>— James & Ana, Returning from Holiday</footer>
              </blockquote>
            </div>
            <div className="testimonial-card">
              <img
                src="/images/testimonial2.png"
                alt="User avatar"
                className="testimonial-avatar"
              />
              <blockquote>
                “I booked a ride to catch a football match — trains were packed,
                but sharing a taxi was smooth, cheaper, and actually fun. It
                just makes sense.”
                <footer>— Liam, Football Fan</footer>
              </blockquote>
            </div>
            <div className="testimonial-card">
              <img
                src="/images/testimonial1.png"
                alt="User avatar"
                className="testimonial-avatar"
              />
              <blockquote>
                “After a long flight from Singapore, I really didn’t want to
                deal with expensive taxis alone. Sharing my ride helped me save
                money and felt good knowing I was making a greener choice.”
                <footer>— Mei, International Student</footer>
              </blockquote>
            </div>
          </div>
        </section>

        {/* TRUST SECTION */}
        <section className="trust">
          <h2>Travel Safely</h2>
          <ul>
            <li>✔ Verified profiles</li>
            <li>✔ Chat before your ride</li>
            <li>✔ Transparent reviews and ratings</li>
            <li>Support local taxi drivers</li>
          </ul>
        </section>

        {/* CTA */}
        <section className="join-now">
          <h2>Ready to TabFair?</h2>
          <p>Create your profile and start your journey.</p>
          <Link to="/signup" className="cta-button secondary">
            Join Now
          </Link>
        </section>
      </main>

      <Footer />
    </>
  );
}
