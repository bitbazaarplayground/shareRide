import React, { useLayoutEffect, useRef, useState } from "react";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";

export default function AutocompleteInput({
  placeholder = "Search...",
  onPlaceSelected,
}) {
  const containerRef = useRef(null);
  const [dropdownWidth, setDropdownWidth] = useState(0);

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({ debounce: 300 });

  // 📏 Set width before paint to prevent layout shift
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

  const handleInput = (e) => {
    setValue(e.target.value);
  };

  const handleSelect = async (description) => {
    setValue(description, false);
    clearSuggestions();

    const results = await getGeocode({ address: description });
    const { lat, lng } = await getLatLng(results[0]);

    onPlaceSelected({
      formatted_address: description,
      lat,
      lng,
      place_id: results[0].place_id,
      geometry: {
        location: {
          lat: () => lat,
          lng: () => lng,
        },
      },
    });
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        value={value}
        onChange={handleInput}
        disabled={!ready}
        placeholder={placeholder}
        style={{ width: "100%" }}
      />

      {status === "OK" && (
        <ul
          className="autocomplete-list"
          style={{
            width: dropdownWidth,
            listStyle: "none",
            padding: "0",
            margin: "0",
            background: "#fff",
            border: "1px solid #ccc",
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 1000,
          }}
        >
          {data.map(({ place_id, description }) => (
            <li
              key={place_id}
              className="autocomplete-item"
              onClick={() => handleSelect(description)}
              style={{
                padding: "0.6rem 1rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                cursor: "pointer",
              }}
            >
              {description}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
