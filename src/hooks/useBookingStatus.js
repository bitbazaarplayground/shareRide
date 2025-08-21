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

  const fetchStatus = useCallback(async () => {
    if (!rideId || !BACKEND) return;
    try {
      const res = await fetch(
        `${BACKEND}/api/rides/${rideId}/booking-status?userId=${encodeURIComponent(
          userId || ""
        )}`
      );
      const json = await res.json();
      setData(json);
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

  return { status: status, loading, error, refresh: fetchStatus };
}
