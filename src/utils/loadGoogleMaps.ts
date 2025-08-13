// src/utils/loadGoogleMaps.ts
type GoogleGlobal = typeof google;

type LoaderOptions = {
  apiKey: string;
  libraries?: string[]; // e.g. ["places", "geometry"]
  v?: string; // e.g. "weekly" | "beta" | "3.58"
  language?: string; // e.g. "en"
  region?: string; // e.g. "US"
  nonce?: string; // CSP
  timeoutMs?: number; // e.g. 15000
  id?: string; // custom <script id>
};

const promiseCache = new Map<string, Promise<GoogleGlobal>>();
const DEFAULT_ID = "gmaps-js-sdk";

/**
 * Build the URL (without callback) so we can key the cache by exact params.
 */
function buildUrl({
  apiKey,
  libraries = ["places"],
  v = "weekly",
  language,
  region,
}: LoaderOptions): string {
  const params = new URLSearchParams({
    key: apiKey,
    libraries: libraries.join(","),
    v, // version pinning is recommended by Google
  });
  if (language) params.set("language", language);
  if (region) params.set("region", region);
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

/**
 * Load Google Maps JS API once per unique URL (keyed by options).
 */
export function loadGoogleMaps(opts: LoaderOptions): Promise<GoogleGlobal> {
  // SSR guard
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error(
        "Google Maps JS API can only be loaded in a browser environment."
      )
    );
  }

  // Already present
  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google as GoogleGlobal);
  }

  const url = buildUrl(opts);
  const id = opts.id ?? DEFAULT_ID;
  const cacheKey = `${id}::${url}`;

  // In-flight / cached
  const cached = promiseCache.get(cacheKey);
  if (cached) return cached;

  // If a script with same id or src already exists, reuse it
  const existing =
    document.getElementById(id) ||
    Array.from(document.scripts).find((s) => s.src === url);

  const timeoutMs = Math.max(0, opts.timeoutMs ?? 15000);

  const loaderPromise: Promise<GoogleGlobal> = new Promise(
    (resolve, reject) => {
      let timeoutHandle: number | undefined;

      const onSuccess = () => {
        if ((window as any).google?.maps) {
          resolve((window as any).google as GoogleGlobal);
        } else {
          reject(
            new Error(
              "Google Maps loaded, but window.google.maps is unavailable."
            )
          );
        }
      };

      const onError = () =>
        reject(new Error("Failed to load the Google Maps JavaScript API."));

      if (existing) {
        // If script tag exists, wait for it to finish by probing on next tick
        // (onload may not be wired if someone else injected it)
        // Keep polling briefly until google.maps appears or we timeout.
        const start = Date.now();
        const poll = () => {
          if ((window as any).google?.maps) return onSuccess();
          if (Date.now() - start > timeoutMs) return onError();
          requestAnimationFrame(poll);
        };
        if (timeoutMs > 0) {
          timeoutHandle = window.setTimeout(onError, timeoutMs);
        }
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
