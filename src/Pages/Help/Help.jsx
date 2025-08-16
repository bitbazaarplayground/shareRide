// src/Pages/Help.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import HelpCombobox from "./HelpCombobox";
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
    img: "/images/help/PassengerHelp.avif",
    alt: "Passenger support",
    to: "/help/passenger",
  },
  {
    slug: "driver",
    title: "Driver",
    img: "/images/help/taxiHelp.avif",
    alt: "Driver support",
    to: "/help/driver",
  },
  {
    slug: "account",
    title: "Your Profile & Account",
    img: "/images/help/YourProfileHelp.avif",
    alt: "Profile and account",
    to: "/help/account",
  },
  {
    slug: "safety",
    title: "Safety & Accessibility",
    img: "/images/help/TrustSafeHelp.avif",
    alt: "Trust, safety and accessibility",
    to: "/help/safety",
  },
  {
    slug: "about",
    title: "How ShareRide works",
    img: "/images/help/about.png",
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
    (async () => {
      try {
        const res = await fetch("/help-index.json", {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) throw new Error("Not JSON");
        const data = await res.json();
        if (alive) setIndexItems(Array.isArray(data) ? data : []);
      } catch (e) {
        if (alive) {
          console.error("help-index.json load failed:", e);
          setIndexItems([]);
        }
      }
    })();
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

        <HelpCombobox
          q={q}
          setQ={setQ}
          results={results}
          renderTitle={(title) => <Highlight text={title} query={q} />}
        />
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
