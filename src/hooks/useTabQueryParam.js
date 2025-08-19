// src/hooks/useTabQueryParam.js
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Keeps a "tab" query param in sync with component state.
 * - Validates against an allowed list of tabs
 * - Uses a default when missing/invalid
 * - Keeps the URL clean (omits ?tab when on default)
 *
 * @param {string[]} tabs - allowed tab ids, e.g. ["published","saved","booked"]
 * @param {string} defaultTab - the default tab id
 * @returns {{ activeTab: string, changeTab: (next:string)=>void }}
 */
export default function useTabQueryParam(tabs, defaultTab) {
  const [searchParams, setSearchParams] = useSearchParams();

  const normalize = (t) => (tabs.includes(t) ? t : defaultTab);

  // Read initial tab from URL
  const initialTab = useMemo(() => {
    const t = (searchParams.get("tab") || "").toLowerCase();
    return normalize(t);
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState(initialTab);

  // Keep state in sync with URL changes (back/forward, external links)
  useEffect(() => {
    const t = normalize((searchParams.get("tab") || "").toLowerCase());
    setActiveTab((prev) => (prev !== t ? t : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Change tab + update URL (omit param on default)
  const changeTab = (next) => {
    const t = normalize((next || "").toLowerCase());
    setActiveTab(t);
    const current = (searchParams.get("tab") || "").toLowerCase();
    if (current !== t) {
      if (t === defaultTab) setSearchParams({});
      else setSearchParams({ tab: t });
    }
  };

  return { activeTab, changeTab };
}
