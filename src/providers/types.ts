// src/providers/types.ts
export type LatLng = { lat: number; lng: number };
export type DeepLinkParams = {
  pickup: { name?: string } & LatLng;
  dropoff: { name?: string } & LatLng;
  productId?: string; // optional Uber product (UberX, etc) if you ever support it
};

export interface RideProvider {
  key: "uber" | "bolt" | "freenow" | string;
  displayName: string;
  supportsDeepLink: boolean;
  buildDeepLink: (params: DeepLinkParams) => string;
}
