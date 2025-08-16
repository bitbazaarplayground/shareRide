import React, { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type ResultItem = { path: string; title: string; category?: string };

type Props = {
  q: string;
  setQ: (next: string) => void;
  results: ResultItem[];
  /** Optional: render highlighted title (we’ll pass your <Highlight/>) */
  renderTitle?: (title: string) => React.ReactNode;
};

export default function HelpCombobox({ q, setQ, results, renderTitle }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // reset highlight on query change
  useEffect(() => {
    setActiveIndex(-1);
  }, [q]);

  const onChoose = (path: string) => navigate(path);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (results.length === 0) return;
    const idx = activeIndex >= 0 ? activeIndex : 0;
    onChoose(results[idx].path);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = results.length;
    if (!count) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1 < count ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 >= 0 ? i - 1 : count - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const idx = activeIndex >= 0 ? activeIndex : 0;
      onChoose(results[idx].path);
    } else if (e.key === "Escape") {
      // optional: collapse/clear
      // setQ("");
    }
  };

  const expanded = Boolean(q && results.length > 0);

  return (
    <>
      <form
        className="search-box"
        role="search"
        aria-labelledby="help-search-label"
        onSubmit={onSubmit}
      >
        <label id="help-search-label" htmlFor="help-search" className="sr-only">
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
          onKeyDown={onKeyDown}
          /* ARIA combobox semantics on the input */
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-activedescendant={
            expanded && activeIndex >= 0
              ? `${listboxId}-opt-${activeIndex}`
              : undefined
          }
        />
        <button type="submit" aria-label="Search">
          🔍
        </button>
      </form>

      {/* Live region for result count (polite & simple) */}
      <p id="help-result-count" className="sr-only" aria-live="polite">
        {q
          ? `${results.length} result${results.length === 1 ? "" : "s"}`
          : "No search yet"}
      </p>

      {/* Popup listbox */}
      {q && (
        <ul
          id={listboxId}
          className="search-results"
          role="listbox"
          aria-label="Search results"
        >
          {results.length === 0 ? (
            <li className="no-results" role="option" aria-selected="false">
              No results. Try different keywords or browse categories below.
            </li>
          ) : (
            results.map((r, idx) => {
              const optionId = `${listboxId}-opt-${idx}`;
              const active = idx === activeIndex;
              return (
                <li
                  key={r.path}
                  id={optionId}
                  role="option"
                  aria-selected={active}
                  className={`result-item${active ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => e.preventDefault()} // keep focus on input
                  onClick={() => onChoose(r.path)}
                >
                  <span className="result-title">
                    {renderTitle ? renderTitle(r.title) : r.title}
                  </span>
                  <span className="result-meta">{r.category}</span>
                </li>
              );
            })
          )}
        </ul>
      )}
    </>
  );
}
