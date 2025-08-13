// src/Pages/Help.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import "./StylesHelp/Help.css";

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function Highlight({ text, query }) {
  if (!query) return text;
  const re = new RegExp(escapeRegExp(query), "ig");
  const parts = text.split(re);
  const matches = text.match(re) || [];
  return parts.reduce((acc, part, i) => {
    acc.push(<span key={`t-${i}`}>{part}</span>);
    if (i < matches.length) acc.push(<mark key={`m-${i}`}>{matches[i]}</mark>);
    return acc;
  }, []);
}

const page = {
  title: "Help Centre — TabFair",
  description:
    "Find help for passengers and drivers: bookings, payments, safety, accessibility, and your account. Search our help articles.",
  canonical: "https://jade-rolypoly-5d4274.netlify.app/help",
  ogImage: "https://jade-rolypoly-5d4274.netlify.app/og-image.jpg",
  published: "2025-06-03",
  modified: "2025-06-03",
};

// Category cards
const categories = [
  {
    slug: "passenger",
    title: "Passenger",
    img: "images/help/PassengerHelp.avif",
    alt: "Passenger support",
    to: "/help/passenger",
  },
  {
    slug: "driver",
    title: "Driver",
    img: "images/help/taxiHelp.avif",
    alt: "Driver support",
    to: "/help/driver",
  },
  {
    slug: "account",
    title: "Your Profile & Account",
    img: "images/help/YourProfileHelp.avif",
    alt: "Profile and account",
    to: "/help/account",
  },
  {
    slug: "safety",
    title: "Safety & Accessibility",
    img: "images/help/TrustSafeHelp.avif",
    alt: "Trust, safety and accessibility",
    to: "/help/safety",
  },
  {
    slug: "about",
    title: "How ShareRide works",
    img: "images/help/about.png",
    alt: "How the app works",
    to: "/help/about",
  },
];

function rankItem(query, item) {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  const title = item.title?.toLowerCase() || "";
  const category = item.category?.toLowerCase() || "";
  const tags = (item.tags || []).map((t) => String(t).toLowerCase());

  let score = 0;
  if (title.includes(q)) score += 5;
  if (tags.some((t) => t.includes(q))) score += 3;
  if (category.includes(q)) score += 2;
  // token bonus (matches all words)
  const words = q.split(/\s+/).filter(Boolean);
  if (
    words.length > 1 &&
    words.every((w) => title.includes(w) || tags.some((t) => t.includes(w)))
  ) {
    score += 2;
  }
  return score;
}

export default function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [q, setQ] = useState(initialQ);
  const [indexItems, setIndexItems] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Fetch the help index once
  useEffect(() => {
    let alive = true;
    fetch("/help-index.json", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : []))
      .then((json) => {
        if (alive) setIndexItems(Array.isArray(json) ? json : []);
      })
      .catch(() => {
        if (alive) setIndexItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Keep ?q= in the URL so header/global search can deep link here
  useEffect(() => {
    const next = q.trim();
    const current = searchParams.get("q") || "";
    if (next !== current) {
      if (next) setSearchParams({ q: next });
      else setSearchParams({});
    }
  }, [q, searchParams, setSearchParams]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const trimmed = q.trim();
    if (!trimmed) return [];
    return indexItems
      .map((item) => ({ item, score: rankItem(trimmed, item) }))
      .filter((x) => x.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title)
      )
      .slice(0, 10)
      .map((x) => x.item);
  }, [q, indexItems]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (results[0]) navigate(results[0].path);
  };

  const popular = useMemo(
    () => indexItems.filter((a) => a.popular).slice(0, 6),
    [indexItems]
  );
  const suggested = useMemo(
    () => indexItems.filter((a) => !a.popular).slice(0, 6),
    [indexItems]
  );
  // Curated lists that react to the query (so the section never disappears)
  const { topList, moreList } = useMemo(() => {
    // Start from your curated sets
    let top = popular;
    let more = suggested;

    if (q.trim()) {
      // Filter curated lists by the same ranking logic
      top = popular.filter((a) => rankItem(q, a) > 0);
      // Use the live search results for "More" but exclude items already in Top
      const topPaths = new Set(top.map((a) => a.path));
      more = results.filter((r) => !topPaths.has(r.path));
    }

    // Cap lengths for a tidy UI
    top = top.slice(0, 6);
    more = more.slice(0, 6);

    return { topList: top, moreList: more };
  }, [q, popular, suggested, results]);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: "https://jade-rolypoly-5d4274.netlify.app/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Help Centre",
        item: page.canonical,
      },
    ],
  };

  const webPageLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description: page.description,
    url: page.canonical,
    inLanguage: "en-GB",
    datePublished: page.published,
    dateModified: page.modified,
  };

  return (
    <main id="main-content" className="help-wrapper" role="main">
      <Helmet>
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
        <link rel="canonical" href={page.canonical} />
        <meta name="robots" content="index,follow" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TabFair" />
        <meta property="og:locale" content="en_GB" />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.description} />
        <meta property="og:url" content={page.canonical} />
        <meta property="og:image" content={page.ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={page.title} />
        <meta name="twitter:description" content={page.description} />
        <meta name="twitter:image" content={page.ogImage} />
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbLd)}
        </script>
        <script type="application/ld+json">{JSON.stringify(webPageLd)}</script>
      </Helmet>

      {/* Top Header */}
      <header className="help-header">
        <h1>How can we help?</h1>

        <form
          className="search-box"
          role="search"
          onSubmit={onSubmit}
          aria-labelledby="help-search-label"
        >
          <label
            id="help-search-label"
            htmlFor="help-search"
            className="sr-only"
          >
            Search help articles
          </label>
          <input
            id="help-search"
            ref={inputRef}
            type="search"
            placeholder="Search help articles"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-describedby="help-result-count"
          />
          <button type="submit" aria-label="Search">
            🔍
          </button>
        </form>

        <p id="help-result-count" className="sr-only" aria-live="polite">
          {q
            ? `${results.length} result${results.length === 1 ? "" : "s"}`
            : "No search yet"}
        </p>

        {/* Inline suggestions */}
        {q && (
          <div
            className="search-results"
            role="listbox"
            aria-label="Search results"
          >
            {results.length === 0 ? (
              <div role="option" aria-selected="false" className="no-results">
                No results. Try different keywords or browse categories below.
              </div>
            ) : (
              results.map((r) => (
                <Link
                  key={r.path}
                  role="option"
                  aria-selected="false"
                  to={r.path}
                  className="result-item"
                >
                  <span className="result-title">
                    <Highlight text={r.title} query={q} />
                  </span>
                  <span className="result-meta">{r.category}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </header>

      {/* Help Category Cards */}
      <section className="help-cards" aria-labelledby="help-categories-heading">
        <h2 id="help-categories-heading" className="sr-only">
          Help categories
        </h2>
        {categories.map((c) => (
          <Link to={c.to} key={c.slug} className="help-card">
            <img
              src={c.img}
              alt={c.alt}
              width="320"
              height="200"
              loading="lazy"
              decoding="async"
            />
            <span>{c.title}</span>
          </Link>
        ))}
      </section>

      {/* Article Sections (only when not searching) */}
      <section className="articles-section" aria-label="Help articles">
        <div className="articles-box">
          <h2>{q ? "Top Articles (matching your search)" : "Top Articles"}</h2>
          {topList.length ? (
            <ul>
              {topList.map((a) => (
                <li key={a.path}>
                  <Link to={a.path}>
                    {q ? <Highlight text={a.title} query={q} /> : a.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="articles-empty">
              No top articles match “{q}”. See results above or try suggestions.
            </p>
          )}
        </div>

        <div className="articles-box">
          <h2>
            {q
              ? "More suggestions related to your search"
              : "Suggested Articles"}
          </h2>
          {moreList.length ? (
            <ul>
              {moreList.map((a) => (
                <li key={a.path}>
                  <Link to={a.path}>
                    {q ? <Highlight text={a.title} query={q} /> : a.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="articles-empty">
              No suggestions for “{q}”. Try broader keywords.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

// import { Link } from "react-router-dom";

// import "./StylesHelp/Help.css";

// export default function HelpPage() {
//   return (
//     <div className="help-wrapper">
//       {/* Top Header */}
//       <header className="help-header">
//         <h1>How can we help?</h1>
//         <div className="search-box">
//           <input type="text" placeholder="Search help articles" />
//           <button aria-label="Search">🔍</button>
//         </div>
//       </header>

//       {/* Help Category Cards */}
//       <section className="help-cards">
//         <Link to="/help/passenger" className="help-card">
//           <img src="/images/PassengerHelp.png" alt="Passenger" />
//           <span>Passenger</span>
//         </Link>
//         <Link to="/help/driver" className="help-card">
//           <img src="public/images/taxiHelp.avif" alt="Driver" />
//           <span>Driver</span>
//         </Link>
//         <Link to="/help/account" className="help-card">
//           <img
//             src="public/images/YourProfileHelp.jpeg"
//             alt="Your Profile and Account"
//           />
//           <span>Your Profile & Account</span>
//         </Link>
//         <Link to="/help/safety" className="help-card">
//           <img src="public/images/TrustSafeHelp.png" alt="Trust and Safety" />
//           <span>Safety & Accessibility</span>
//         </Link>
//         <Link to="/help/about" className="help-card">
//           <img src="/images/help/about.png" alt="About App" />
//           <span>About ShareRide</span>
//         </Link>
//       </section>

//       {/* Article Sections */}
//       <section className="articles-section">
//         <div className="articles-box">
//           <h2>Top Articles</h2>
//           <ul>
//             <li>
//               <Link to="/help/rating-driver">Rating your carpool driver</Link>
//             </li>
//             <li>
//               <Link to="/help/passenger-cancellation">
//                 Passenger cancellation rate
//               </Link>
//             </li>
//           </ul>
//         </div>

//         <div className="articles-box">
//           <h2>Suggested Articles</h2>
//           <ul>
//             <li>
//               <Link to="/help/luggage-policy">Bus Luggage Policy</Link>
//             </li>
//             <li>
//               <Link to="/help/booking">Booking a bus online</Link>
//             </li>
//             <li>
//               <Link to="/help/bus-cancellation">Bus Cancellation Policy</Link>
//             </li>
//             <li>
//               <Link to="/help/cancel-booking">Cancelling your bus booking</Link>
//             </li>
//             <li>
//               <Link to="/help/offering-ride">Offering a ride</Link>
//             </li>
//           </ul>
//         </div>
//       </section>
//     </div>
//   );
// }
