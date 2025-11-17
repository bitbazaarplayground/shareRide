// src/hooks/useBookingStatus.js
import { useCallback, useEffect, useState } from "react";

export default function useBookingStatus(
  rideId,
  userId,
  { pollMs = 5000 } = {}
) {
  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(rideId));
  const [error, setError] = useState(null);

  const normalizeStatus = (raw) => {
    if (!raw) return "pending";
    if (["collecting", "bookable"].includes(raw)) return "pending";
    if (["confirmed", "checking_in", "active"].includes(raw))
      return "confirmed";
    if (["canceled", "refunded", "failed"].includes(raw)) return "canceled";
    return raw; // fallback
  };

  const fetchStatus = useCallback(async () => {
    if (!rideId || !BACKEND) return;
    try {
      // build URL properly
      let url = `${BACKEND}/api/rides/${rideId}/booking-status`;
      if (userId) {
        url += `?userId=${encodeURIComponent(userId)}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch booking status`);
      }

      const json = await res.json();

      // normalize booking status
      const normalized = {
        ...json,
        status: normalizeStatus(json?.status),
      };

      setData(normalized);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [rideId, userId, BACKEND]);

  useEffect(() => {
    setLoading(Boolean(rideId));
    fetchStatus();
    const t = setInterval(fetchStatus, pollMs);
    return () => clearInterval(t);
  }, [fetchStatus, pollMs]);

  return { data, status: data, loading, error, refresh: fetchStatus };
}
