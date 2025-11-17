// src/Components/BookingFlow/ConfirmBookedButton.jsx

import { useState } from "react";
import useBookingStatus from "../../hooks/useBookingStatus";

export default function ConfirmBookedButton({ rideId, user }) {
  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;
  const userId = user?.id;
  const userEmail = user?.email || null;

  const { status, loading, refresh } = useBookingStatus(rideId, userId, {
    pollMs: 8000,
  });
  const [busy, setBusy] = useState(false);

  if (loading || !status?.exists) return null;

  // Only booker can see this; must be ready_to_book or booking, and quorum met
  const quorumMet = status.checkedInCount >= (status.minContributors || 2);
  const canConfirm =
    status.isBooker && status.status === "ready_to_book" && status.quorumMet;

  if (!canConfirm) {
    if (status.isBooker && !status.quorumMet) {
      return <p className="muted">Waiting for more riders to check in…</p>;
    }
    return null;
  }

  const onConfirm = async () => {
    if (!BACKEND) return alert("Backend not configured (VITE_STRIPE_BACKEND).");
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND}/api/rides/${rideId}/confirm-booked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();

      if (!res.ok) {
        // Booker not onboarded to Stripe Connect? Kick off onboarding.
        if (json.needs_onboarding) {
          const linkRes = await fetch(`${BACKEND}/api/booker/onboarding-link`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              email: userEmail,
              returnTo: window.location.href,
            }),
          });
          const linkJson = await linkRes.json();
          if (linkRes.ok && linkJson.url) {
            window.location.href = linkJson.url;
            return;
          }
        }
        throw new Error(json.error || "Failed to confirm booking.");
      }

      alert("✅ Thanks! Your reimbursement transfer has been created.");
      await refresh();
    } catch (e) {
      console.error(e);
      alert(e.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!canConfirm) return null;

  return (
    <button className="btn btn-primary" onClick={onConfirm} disabled={busy}>
      {busy ? "Transferring…" : "I booked the Uber — reimburse me"}
    </button>
  );
}
