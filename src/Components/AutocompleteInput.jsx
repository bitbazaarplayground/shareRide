import React from "react";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";

export default function AutocompleteInput({
  placeholder = "Search...",
  onPlaceSelected,
}) {
  if (!window.google || !window.google.maps || !window.google.maps.places) {
    return <p>Loading map search...</p>; // ✅ avoid loading before script is ready
  }

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({ debounce: 300 });

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
    <div style={{ position: "relative" }}>
      <input
        value={value}
        onChange={handleInput}
        disabled={!ready}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "10px",
          fontSize: "16px",
          borderRadius: "6px",
          border: "1px solid #ccc",
          marginBottom: "10px",
        }}
      />
      {status === "OK" && (
        <ul
          style={{
            listStyle: "none",
            padding: "0",
            margin: "0",
            background: "#fff",
            border: "1px solid #ccc",
            position: "absolute",
            width: "100%",
            zIndex: 1000,
          }}
        >
          {data.map(({ place_id, description }) => (
            <li
              key={place_id}
              onClick={() => handleSelect(description)}
              style={{
                padding: "10px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
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
