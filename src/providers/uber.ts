// src/providers/uber.ts
import type { DeepLinkParams, RideProvider } from "./types";

export const UberProvider: RideProvider = {
  key: "uber",
  displayName: "Uber",
  supportsDeepLink: true,
  buildDeepLink(params: DeepLinkParams) {
    const { pickup, dropoff } = params;
    // Mobile web link works on desktop/mobile; adds graceful fallbacks
    const base = "https://m.uber.com/";
    const q = new URLSearchParams({
      action: "setPickup",
      "pickup[latitude]": String(pickup.lat),
      "pickup[longitude]": String(pickup.lng),
      "pickup[nickname]": pickup.name || "Pickup",
      "dropoff[latitude]": String(dropoff.lat),
      "dropoff[longitude]": String(dropoff.lng),
      "dropoff[nickname]": dropoff.name || "Dropoff",
      // Optional: client_id, referral, product_id if you ever use them
    });
    return `${base}?${q.toString()}`;
  },
};
