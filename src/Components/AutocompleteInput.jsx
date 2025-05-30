// Google API places/location
import React, { useEffect, useRef } from "react";

export default function AutocompleteInput({ placeholder, onPlaceSelected }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!window.google) return;

    const autocomplete = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ["geocode"], // or ["(cities)"] for city-specific
      }
    );

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      onPlaceSelected(place);
    });
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      className="search-input"
      placeholder={placeholder}
    />
  );
}
