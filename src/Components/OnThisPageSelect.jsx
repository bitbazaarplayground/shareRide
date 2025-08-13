// src/components/OnThisPageSelect.jsx
import { useEffect, useId, useMemo, useState } from "react";
import "./Styles/OnThisPageSelect.css";

function getHeaderOffset() {
  // Optional: read a CSS var to account for a fixed site header height
  // In your global CSS you can set: :root { --fixed-header: 64px; }
  const root = getComputedStyle(document.documentElement).getPropertyValue(
    "--fixed-header"
  );
  const n = parseInt(root, 10);
  return Number.isFinite(n) ? n : 0;
}

function smoothScrollTo(el) {
  if (!el) return;
  const rectTop = el.getBoundingClientRect().top + window.scrollY;
  const offset = getHeaderOffset() + 8; // +8px breathing room
  const target = Math.max(0, rectTop - offset);
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  window.scrollTo({
    top: target,
    behavior: prefersReduced ? "auto" : "smooth",
  });
}

export default function OnThisPageSelect({
  scopeSelector = "main", // where to look for sections
  sticky = true, // make the bar sticky by default
  minSections = 2, // don't render if fewer sections
  label = "Jump to",
}) {
  const labelId = useId();
  const [sections, setSections] = useState([]);
  const [activeId, setActiveId] = useState("");

  // Build list of sections from <section id="..."><h2>...</h2></section>
  useEffect(() => {
    const root = document.querySelector(scopeSelector);
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll("section[id] > h2"));
    const items = nodes
      .map((h2) => {
        const id = h2.parentElement?.id;
        const label = h2.textContent?.trim() || id;
        return id ? { id, label } : null;
      })
      .filter(Boolean);

    setSections(items);

    // Preselect current hash, else first section
    const hash = decodeURIComponent(window.location.hash || "").replace(
      "#",
      ""
    );
    if (hash && items.some((s) => s.id === hash)) {
      setActiveId(hash);
      const el = document.getElementById(hash);
      if (el) setTimeout(() => smoothScrollTo(el), 0);
    } else if (items[0]) {
      setActiveId(items[0].id);
    }

    // Track active section while scrolling
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        // Trigger a bit before the heading reaches the very top
        rootMargin: `-${getHeaderOffset() + 24}px 0px -70% 0px`,
        threshold: [0, 1.0],
      }
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [scopeSelector]);

  const className = useMemo(
    () => `otp-select${sticky ? " otp-sticky" : ""}`,
    [sticky]
  );

  if (sections.length < minSections) return null;

  const handleChange = (e) => {
    const id = e.target.value;
    const el = document.getElementById(id);
    if (el) {
      smoothScrollTo(el);
      // update URL hash without jumping
      history.replaceState(null, "", `#${id}`);
      setActiveId(id);
      e.currentTarget.blur();
    }
  };

  return (
    <div className={className}>
      <label id={labelId} htmlFor="jump-to" className="otp-label">
        {label}
      </label>
      <select
        id="jump-to"
        aria-labelledby={labelId}
        value={activeId}
        onChange={handleChange}
        className="otp-control"
      >
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
