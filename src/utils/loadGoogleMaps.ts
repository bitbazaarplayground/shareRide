// src/utils/loadGoogleMaps.ts
type GoogleGlobal = typeof google;

type LoaderOptions = {
  apiKey: string;
  libraries?: string[]; // ["places", "geometry"]
  v?: string; // "weekly" | "beta" | "3.58"
  language?: string;
  region?: string;
  nonce?: string;
  timeoutMs?: number; // overall loader timeout
  id?: string; // <script id>
  loading?: "async" | "defer"; // Google param; "async" recommended
};

const promiseCache = new Map<string, Promise<GoogleGlobal>>();
const DEFAULT_ID = "gmaps-js-sdk";

/** Build the API URL */
function buildUrl({
  apiKey,
  libraries = ["places"],
  v = "weekly",
  language,
  region,
  loading = "async",
}: LoaderOptions): string {
  const params = new URLSearchParams({
    key: apiKey,
    v,
    loading, // silences SDK warning
  });
  if (libraries.length) params.set("libraries", libraries.join(","));
  if (language) params.set("language", language);
  if (region) params.set("region", region);
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

/** Wait for google.maps.places to exist; try importLibrary first */
async function waitForPlaces(timeoutMs = 4000): Promise<GoogleGlobal> {
  const start = Date.now();
  const hasPlaces = () =>
    (window as any).google?.maps?.places
      ? ((window as any).google as GoogleGlobal)
      : null;

  const g0 = hasPlaces();
  if (g0) return g0;

  const g = (window as any).google;
  if (g?.maps?.importLibrary) {
    try {
      await g.maps.importLibrary("places");
      const g1 = hasPlaces();
      if (g1) return g1;
    } catch {
      // fall through to polling
    }
  }

  return new Promise<GoogleGlobal>((resolve, reject) => {
    const tick = () => {
      const gx = hasPlaces();
      if (gx) return resolve(gx);
      if (Date.now() - start > timeoutMs) {
        return reject(
          new Error(
            "Google Maps loaded, but Places library was not available in time."
          )
        );
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

export function loadGoogleMaps(opts: LoaderOptions): Promise<GoogleGlobal> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error(
        "Google Maps JS API can only be loaded in a browser environment."
      )
    );
  }

  if ((window as any).google?.maps) {
    // Maps is there; ensure Places is ready
    return waitForPlaces();
  }

  const url = buildUrl(opts);
  const id = opts.id ?? DEFAULT_ID;
  const cacheKey = `${id}::${url}`;

  const cached = promiseCache.get(cacheKey);
  if (cached) return cached;

  // Reuse any existing Maps script (param order may differ)
  const existing =
    document.getElementById(id) ||
    Array.from(document.scripts).find((s) =>
      s.src.startsWith("https://maps.googleapis.com/maps/api/js")
    );

  const timeoutMs = Math.max(0, opts.timeoutMs ?? 15000);

  const loaderPromise: Promise<GoogleGlobal> = new Promise(
    (resolve, reject) => {
      let timeoutHandle: number | undefined;

      const onSuccess = async () => {
        try {
          const g = await waitForPlaces(); // 👈 ensure Places, with small wait
          resolve(g);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      };
      const onError = () =>
        reject(new Error("Failed to load the Google Maps JavaScript API."));

      if (existing) {
        // If a script is already present, poll until google.maps appears, then ensure Places.
        const start = Date.now();
        const poll = () => {
          if ((window as any).google?.maps) return onSuccess();
          if (Date.now() - start > timeoutMs) return onError();
          requestAnimationFrame(poll);
        };
        if (timeoutMs > 0)
          timeoutHandle = window.setTimeout(onError, timeoutMs);
        poll();
        return;
      }

      const script = document.createElement("script");
      script.id = id;
      script.src = url;
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      if (opts.nonce) script.nonce = opts.nonce;

      script.onload = () => {
        if (timeoutHandle) window.clearTimeout(timeoutHandle);
        onSuccess();
      };
      script.onerror = () => {
        if (timeoutHandle) window.clearTimeout(timeoutHandle);
        onError();
      };

      if (timeoutMs > 0) {
        timeoutHandle = window.setTimeout(() => {
          script.onload = null;
          script.onerror = null;
          onError();
        }, timeoutMs);
      }

      document.head.appendChild(script);
    }
  );

  promiseCache.set(cacheKey, loaderPromise);
  return loaderPromise;
}
