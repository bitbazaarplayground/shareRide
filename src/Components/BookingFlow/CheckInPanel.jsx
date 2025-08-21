// src/Components/BookingFlow/CheckInPanel.jsx
import { useState } from "react";
import useBookingStatus from "../../hooks/useBookingStatus";

export default function CheckInPanel({ rideId, user }) {
  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;
  const userId = user?.id;
  const { status, loading, refresh } = useBookingStatus(rideId, userId, {
    pollMs: 8000,
  });

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const show =
    !loading &&
    status?.exists &&
    (status.codeActive || status.status === "checking_in");

  const onCheckIn = async () => {
    if (!BACKEND) return alert("Backend not configured.");
    if (!code.trim()) return alert("Enter the code you received.");
    setBusy(true);
    try {
      const res = await fetch(`${BACKEND}/api/rides/${rideId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: code.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Check-in failed");
      alert(`✅ Checked in. (${json.checkedInCount}/${json.required})`);
      setCode("");
      refresh();
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to check in.");
    } finally {
      setBusy(false);
    }
  };

  if (!show) return null;

  return (
    <div className="checkin-panel">
      <h4>Enter check-in code</h4>
      <div className="checkin-row">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Check-in code"
        />
        <button className="btn" onClick={onCheckIn} disabled={busy}>
          {busy ? "Checking in…" : "Check in"}
        </button>
      </div>
      <p className="muted">
        This confirms you’re present with the group and unlocks booking.
      </p>
    </div>
  );
}
