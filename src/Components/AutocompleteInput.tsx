// src/Components/AutocompleteInput.tsx
import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import usePlacesAutocomplete from "use-places-autocomplete";
import { loadGoogleMaps } from "../utils/loadGoogleMaps";

export type SelectedPlace = {
  formatted_address: string;
  lat: number;
  lng: number;
  place_id?: string;
};

type BiasCircle = { lat: number; lng: number; radiusMeters: number };

// NOTE: we type requestOptions as Partial so 'input' is optional.
// This resolves: “Property 'input' is missing in type '{}' but required…”
type AutocompleteRequestOpts =
  | Partial<google.maps.places.AutocompletionRequest>
  | undefined;

interface AutocompleteInputProps {
  id?: string;
  name?: string;
  placeholder?: string;
  onPlaceSelected: (place: SelectedPlace) => void;
  /** Restrict to countries (e.g., ['gb']); omit for global */
  countries?: string[];
  /** Prefer results near these coordinates without restricting */
  bias?: BiasCircle;
}

export default function AutocompleteInput({
  id,
  name,
  placeholder = "Search…",
  onPlaceSelected,
  countries,
  bias,
}: AutocompleteInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownWidth, setDropdownWidth] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [mapsReady, setMapsReady] = useState<boolean>(
    !!(window as any).google?.maps?.places
  );
  const [sessionToken, setSessionToken] =
    useState<google.maps.places.AutocompleteSessionToken | null>(null);
  const serviceRef = useRef<google.maps.places.PlacesService | null>(null);

  const autoId = useId();
  const inputId = id ?? autoId;
  const listboxId = `${inputId}-listbox`;

  // Keep dropdown width equal to input width
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

  // Pre-warm Maps/Places (optional). Remove this effect if you want focus-only loading.
  useEffect(() => {
    if (mapsReady) return;
    loadGoogleMaps({
      apiKey: import.meta.env.VITE_MAPS_KEY,
      libraries: ["places"],
      v: "weekly",
      timeoutMs: 15000,
    })
      .then(() => setMapsReady(true))
      .catch(() => {
        /* ignore; onFocus will retry */
      });
  }, [mapsReady]);

  // Create a PlacesService once Maps is ready
  useEffect(() => {
    if (!mapsReady || serviceRef.current) return;
    const dummy = document.createElement("div");
    serviceRef.current = new google.maps.places.PlacesService(dummy);
  }, [mapsReady]);

  // Ensure Maps is loaded and we have a session token
  const ensureSession = async () => {
    if (!mapsReady) {
      await loadGoogleMaps({
        apiKey: import.meta.env.VITE_MAPS_KEY,
        libraries: ["places"],
        v: "weekly",
        timeoutMs: 15000,
      });
      setMapsReady(true);
    }
    if (!sessionToken) {
      setSessionToken(new google.maps.places.AutocompleteSessionToken());
    }
  };

  // Build request options (NO 'input' here; hook sets it)
  const requestOptions = useMemo<AutocompleteRequestOpts>(() => {
    if (!mapsReady) return undefined;
    const opts: Partial<google.maps.places.AutocompletionRequest> = {};

    // Link autocomplete predictions to our session (free keystrokes)
    if (sessionToken) (opts as any).sessionToken = sessionToken;

    // Restrict or bias results
    if (countries?.length) {
      (opts as any).componentRestrictions = { country: countries };
    } else if (bias) {
      (opts as any).locationBias = {
        center: new google.maps.LatLng(bias.lat, bias.lng),
        radius: bias.radiusMeters,
      };
    }
    return opts;
  }, [mapsReady, sessionToken, countries, bias]);

  // Initialize hook only when Maps is ready
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    debounce: 300,
    initOnMount: mapsReady,
    requestOptions, // <- now typed as Partial to avoid the 'input' error
  });

  const onFocus = () => {
    void ensureSession();
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setHighlightedIndex(-1);
  };

  // Fetch minimal Place Details using the same session token (paid once)
  const fetchPlaceDetails = (placeId: string): Promise<SelectedPlace> =>
    new Promise((resolve, reject) => {
      const service = serviceRef.current;
      if (!service) return reject(new Error("PlacesService not initialized"));

      const fields: (keyof google.maps.places.PlaceResult)[] = [
        "formatted_address",
        "geometry",
        "place_id",
      ];

      service.getDetails(
        {
          placeId,
          fields: fields as any,
          sessionToken: sessionToken ?? undefined,
        },
        (result, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !result) {
            return reject(new Error(`getDetails failed: ${status}`));
          }
          const loc = result.geometry?.location;
          if (!loc) return reject(new Error("No geometry.location in details"));
          resolve({
            formatted_address: result.formatted_address ?? "",
            lat: loc.lat(),
            lng: loc.lng(),
            place_id: result.place_id,
          });
        }
      );
    });

  const handleSelectPrediction = async (index: number) => {
    const prediction = data[index];
    if (!prediction) return;
    try {
      await ensureSession();
      setValue(prediction.description, false);
      clearSuggestions();
      setHighlightedIndex(-1);

      if (prediction.place_id) {
        const place = await fetchPlaceDetails(prediction.place_id);
        onPlaceSelected(place);
      } else {
        // Rare; if no place_id, treat as raw text (let parent decide)
        onPlaceSelected({
          formatted_address: prediction.description,
          lat: NaN,
          lng: NaN,
        });
      }
    } finally {
      // End session after a selection; next focus will create a new token
      setSessionToken(null);
    }
  };

  // Keyboard handling
  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && status === "OK" && data.length) {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, data.length - 1));
      return;
    }
    if (e.key === "ArrowUp" && status === "OK" && data.length) {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0) {
        await handleSelectPrediction(highlightedIndex);
        return;
      }
      // Fallback: user pressed Enter on free text → single geocode (paid)
      const raw = value.trim();
      if (!raw) return;

      try {
        await ensureSession();
        const { getGeocode, getLatLng } = await import(
          "use-places-autocomplete"
        );
        const results = await getGeocode({ address: raw });
        if (results?.length) {
          const { lat, lng } = await getLatLng(results[0]);
          onPlaceSelected({
            formatted_address: results[0].formatted_address ?? raw,
            lat,
            lng,
            place_id: results[0].place_id,
          });
        }
      } catch (err) {
        console.error("Fallback geocode failed:", err);
      } finally {
        setSessionToken(null);
      }
      return;
    }
    if (e.key === "Escape") {
      clearSuggestions();
      return;
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
      aria-controls={listboxId}
      aria-labelledby={inputId}
    >
      <input
        id={inputId}
        name={name}
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={
          highlightedIndex >= 0 && data[highlightedIndex]
            ? `${listboxId}-opt-${highlightedIndex}`
            : undefined
        }
        aria-busy={!mapsReady && !!value}
        style={{
          width: "100%",
          opacity: mapsReady ? 1 : 0.85,
          transition: "opacity .2s",
        }}
      />

      {status === "OK" && data.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="autocomplete-list"
          style={{ width: dropdownWidth }}
          aria-label="Place suggestions"
        >
          {data.map((prediction, index) => {
            const id = `${listboxId}-opt-${index}`;
            const isActive = highlightedIndex === index;
            return (
              <li
                id={id}
                role="option"
                aria-selected={isActive}
                key={prediction.place_id ?? id}
                className={`autocomplete-item${isActive ? " highlighted" : ""}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                onClick={() => void handleSelectPrediction(index)}
              >
                {prediction.description}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
