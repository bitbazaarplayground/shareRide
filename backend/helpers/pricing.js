// backend/helpers/pricing.js

/**
 * Convert pounds (GBP) to minor units (pence).
 * Example: 12.34 -> 1234
 */
export const toMinor = (gbp) => Math.round(Number(gbp) * 100);

/**
 * Clamp a number between min and max.
 */
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

/**
 * Current timestamp in ISO format.
 */
export const nowIso = () => new Date().toISOString();

/**
 * Generate a random 6-digit code (zero-padded).
 */
export function generateCode6() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}
