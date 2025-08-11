import React, { useId, useLayoutEffect, useRef, useState } from "react";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";

/** Keep the public API simple and framework-agnostic */
export type SelectedPlace = {
  formatted_address: string;
  lat: number;
  lng: number;
  place_id?: string;
};

interface AutocompleteInputProps {
  placeholder?: string;
  onPlaceSelected: (place: SelectedPlace) => void;
}

export default function AutocompleteInput({
  placeholder = "Search...",
  onPlaceSelected,
}: AutocompleteInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownWidth, setDropdownWidth] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [mapsReady, setMapsReady] = useState(false);
  const listboxId = useId();

  // Sync dropdown width to input width
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setDropdownWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Hook: initialize only after Google Maps is ready
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    debounce: 300,
    initOnMount: mapsReady, // ⬅️ important: don’t init before Maps loads
    requestOptions: mapsReady ? {} : undefined,
  });

  const safelyLoadMaps = () => {
    if (mapsReady) return;
    loadGoogleMaps({
      apiKey: import.meta.env.VITE_MAPS_KEY,
      libraries: ["places"],
      v: "weekly",
      timeoutMs: 15000,
    })
      .then(() => setMapsReady(true))
      .catch((err) => {
        console.error("Google Maps failed to load:", err);
      });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setHighlightedIndex(-1);
  };

  const handleSelect = async (description: string) => {
    try {
      setValue(description, false);
      clearSuggestions();
      setHighlightedIndex(-1);

      // getGeocode returns google.maps.GeocoderResult[]
      const results = (await getGeocode({
        address: description,
      })) as google.maps.GeocoderResult[];
      if (!results || results.length === 0) return;

      const { lat, lng } = await getLatLng(results[0]); // returns { lat: number, lng: number }

      onPlaceSelected({
        formatted_address: description,
        lat,
        lng,
        place_id: results[0].place_id,
      });
    } catch (err) {
      console.error("Geocode failed:", err);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (status !== "OK" || data.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, data.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(data[highlightedIndex].description);
    } else if (e.key === "Escape") {
      clearSuggestions();
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", width: "100%" }}
      role="combobox"
      aria-expanded={status === "OK"}
      aria-owns={listboxId}
      aria-haspopup="listbox"
    >
      <input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        onFocus={safelyLoadMaps}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={
          highlightedIndex >= 0 && data[highlightedIndex]
            ? `${listboxId}-opt-${highlightedIndex}`
            : undefined
        }
        disabled={!mapsReady && value.length > 0}
        style={{
          width: "100%",
          opacity: mapsReady ? 1 : 0.6,
          transition: "opacity 0.2s",
        }}
      />

      {status === "OK" && data.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="autocomplete-list"
          style={{ width: dropdownWidth }}
        >
          {data.map(({ place_id, description }, index) => {
            const id = `${listboxId}-opt-${index}`;
            const isActive = highlightedIndex === index;
            return (
              <li
                id={id}
                role="option"
                aria-selected={isActive}
                key={place_id ?? id}
                className={`autocomplete-item${isActive ? " highlighted" : ""}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                onClick={() => handleSelect(description)}
              >
                {description}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
