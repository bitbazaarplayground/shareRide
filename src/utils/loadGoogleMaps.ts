// src/utils/loadGoogleMaps.ts
type GoogleGlobal = typeof google;

type LoaderOptions = {
  apiKey: string;
  libraries?: string[]; // e.g. ["places", "geometry"]
  v?: string; // e.g. "weekly" | "beta" | "3.58"
  language?: string;
  region?: string;
  nonce?: string;
  timeoutMs?: number;
  id?: string;
};

const promiseCache = new Map<string, Promise<GoogleGlobal>>();
const DEFAULT_ID = "gmaps-js-sdk";

function buildUrl({
  apiKey,
  libraries = ["places"],
  v = "weekly",
  language,
  region,
}: LoaderOptions): string {
  const params = new URLSearchParams({
    key: apiKey,
    v,
  });
  // Note: for modern Maps, libraries can be loaded via importLibrary.
  // We still include &libraries=... for backward compatibility.
  if (libraries.length) params.set("libraries", libraries.join(","));
  if (language) params.set("language", language);
  if (region) params.set("region", region);
  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
}

// Ensure Places is actually available (works with both legacy & modern API)
async function ensurePlaces(g: any): Promise<GoogleGlobal> {
  if (g?.maps?.places) return g as GoogleGlobal;
  if (g?.maps?.importLibrary) {
    await g.maps.importLibrary("places");
    return g as GoogleGlobal;
  }
  throw new Error("Google Maps loaded without Places library.");
}

export function loadGoogleMaps(opts: LoaderOptions): Promise<GoogleGlobal> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error(
        "Google Maps JS API can only be loaded in a browser environment."
      )
    );
  }

  const g = (window as any).google;
  if (g?.maps) {
    // Already loaded — make sure Places exists too
    return ensurePlaces(g);
  }

  const url = buildUrl(opts);
  const id = opts.id ?? DEFAULT_ID;
  const cacheKey = `${id}::${url}`;

  const cached = promiseCache.get(cacheKey);
  if (cached) return cached;

  const existing =
    document.getElementById(id) ||
    Array.from(document.scripts).find((s) => s.src === url);

  const timeoutMs = Math.max(0, opts.timeoutMs ?? 15000);

  const loaderPromise: Promise<GoogleGlobal> = new Promise(
    (resolve, reject) => {
      let timeoutHandle: number | undefined;

      const onSuccess = async () => {
        try {
          const gNow = (window as any).google;
          const ok = await ensurePlaces(gNow);
          resolve(ok);
        } catch (e) {
          reject(e instanceof Error ? e : new Error(String(e)));
        }
      };
      const onError = () =>
        reject(new Error("Failed to load the Google Maps JavaScript API."));

      if (existing) {
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
