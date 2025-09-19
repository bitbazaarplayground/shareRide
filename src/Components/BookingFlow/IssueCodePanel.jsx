// src/Components/BookingFlow/IssueCodePanel.jsx
import { useEffect, useState } from "react";
import useBookingStatus from "../../hooks/useBookingStatus";

export default function IssueCodePanel({ rideId, user }) {
  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;
  const userId = user?.id;
  const { status, loading, refresh } = useBookingStatus(rideId, userId, {
    pollMs: 8000,
  });

  const [ttl, setTtl] = useState(600); // 10 minutes default
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(null); // seconds

  // ---- Helpful message ----
  if (!canIssue) {
    if (status?.isBooker && (status?.paidSeats || 0) < 2) {
      return (
        <p className="muted">
          Waiting for at least one rider to confirm payment before issuing a
          check-in code.
        </p>
      );
    }
    return null;
  }
  // Booker can issue code only if host & at least one rider are paid
  const enoughPaid = (status?.paidSeats || 0) >= 2; // host + ≥1 rider
  const canIssue =
    !loading &&
    status?.exists &&
    status.isBooker &&
    enoughPaid &&
    ["bookable", "checking_in"].includes(status.status);

  const code = status?.codeActive ? "••••••" : null; // we don’t expose the code value from status; server returns it only when created
  const expiresAt = status?.codeExpiresAt
    ? new Date(status.codeExpiresAt)
    : null;

  // Drive countdown
  useEffect(() => {
    if (!expiresAt) {
      setCountdown(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      );
      setCountdown(remaining);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const onIssue = async () => {
    if (!BACKEND) return alert("Backend not configured.");
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND}/api/rides/${rideId}/issue-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ttlSeconds: ttl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to issue code");

      // Show the actual code returned this time
      alert(`Share this code: ${json.code}\nExpires at: ${json.expiresAt}`);
      refresh();
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to issue code");
    } finally {
      setBusy(false);
    }
  };

  if (!canIssue) return null;

  return (
    <div className="issue-code-panel">
      <h4>Check-in code</h4>
      {status?.codeActive ? (
        <p className="muted">
          A check-in session is active.{" "}
          {countdown != null && countdown > 0
            ? `Expires in ${Math.floor(countdown / 60)}m ${countdown % 60}s.`
            : "Expiring soon…"}
        </p>
      ) : (
        <>
          <label htmlFor={`ttl-${rideId}`}>Duration</label>
          <select
            id={`ttl-${rideId}`}
            value={ttl}
            onChange={(e) => setTtl(Number(e.target.value))}
          >
            <option value={300}>5 minutes</option>
            <option value={600}>10 minutes</option>
            <option value={900}>15 minutes</option>
          </select>
          <button className="btn" onClick={onIssue} disabled={busy}>
            {busy ? "Generating…" : "Generate check-in code"}
          </button>
        </>
      )}
    </div>
  );
}
