// src/providers/index.ts
import type { RideProvider } from "./types";
import { UberProvider } from "./uber";

export const Providers: Record<string, RideProvider> = {
  uber: UberProvider,
  // bolt: BoltProvider, // add later
  // freenow: FreeNowProvider, // add later
};

export function buildProviderDeepLink(providerKey: string, params: any) {
  const p = Providers[providerKey];
  if (!p || !p.supportsDeepLink) return "";
  return p.buildDeepLink(params);
}
