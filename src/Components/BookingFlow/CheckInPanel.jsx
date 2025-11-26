// src/BookingFlow/CheckInPanel.jsx
import { useState } from "react";
import { toast } from "react-toastify";
import useBookingStatus from "../../hooks/useBookingStatus";

export default function CheckInPanel({ rideId, user }) {
  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;
  const userId = user?.id;
  const { status, loading, refresh } = useBookingStatus(rideId, userId, {
    pollMs: 8000,
  });

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [checkedInMessage, setCheckedInMessage] = useState(""); // ✅ success feedback message

  const show =
    !loading &&
    status?.exists &&
    (status.codeActive || status.status === "checking_in");

  const onCheckIn = async () => {
    if (!BACKEND) return toast.error("Backend not configured.");
    if (!code.trim())
      return toast.warning("Please enter your 6-character code.");

    setBusy(true);
    try {
      const res = await fetch(`${BACKEND}/api/rides/${rideId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: code.trim() }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (json.error?.toLowerCase().includes("invalid"))
          toast.error("❌ Invalid code. Please check and try again.");
        else if (json.error?.toLowerCase().includes("expired"))
          toast.error("⏰ This code has expired. Ask your host to reissue it.");
        else if (json.error?.toLowerCase().includes("already"))
          toast.info("✅ You’re already checked in.");
        else toast.error(json.error || "Check-in failed.");
        return;
      }

      toast.success(
        `✅ Checked in successfully (${json.checkedInCount}/${json.required} riders present)`
      );

      // ✅ Show success message visually under button
      setCheckedInMessage("✅ You’re checked in!");
      setTimeout(() => setCheckedInMessage(""), 5000); // auto-hide after 5s

      setCode("");
      refresh();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to check in.");
    } finally {
      setBusy(false);
    }
  };

  const onClaimHost = async () => {
    if (!BACKEND) return toast.error("Backend not configured.");
    setClaiming(true);
    try {
      const res = await fetch(`${BACKEND}/api/rides/${rideId}/claim-booker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to claim host");

      toast.success("👑 You are now the host! You can generate new codes.");
      refresh();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to claim host.");
    } finally {
      setClaiming(false);
    }
  };

  if (!show) return null;

  const canClaimHost =
    status?.status === "checking_in" || status?.status === "ready_to_book";

  return (
    <div className="checkin-panel">
      <h4>Enter your check-in code</h4>

      {status?.isBooker && (
        <span
          style={{
            display: "inline-block",
            background: "#007bff",
            color: "white",
            borderRadius: "12px",
            padding: "2px 10px",
            fontSize: "0.85rem",
            marginBottom: "0.5rem",
          }}
        >
          ⭐ You are the host
        </span>
      )}

      <div className="checkin-row" style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          inputMode="text"
          pattern="[A-Z0-9]*"
          maxLength={6}
          placeholder="Enter 6-character code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          aria-label="Check-in code"
          style={{
            flex: 1,
            padding: "0.4rem",
            borderRadius: "6px",
            border: "1px solid #ccc",
          }}
        />
        <button
          className="btn"
          onClick={onCheckIn}
          disabled={busy}
          style={{ minWidth: "110px" }}
        >
          {busy ? "Checking in…" : "Check in"}
        </button>
      </div>

      {/* ✅ Success message (fades after 5s) */}
      {checkedInMessage && (
        <p
          style={{
            color: "green",
            fontWeight: 600,
            marginTop: "0.4rem",
            transition: "opacity 0.4s ease",
          }}
        >
          {checkedInMessage}
        </p>
      )}

      <p className="muted">
        Enter the code you received after meeting your host.
      </p>

      {canClaimHost && !status?.isBooker && (
        <div style={{ marginTop: "0.75rem" }}>
          <button
            className="btn btn-secondary"
            onClick={onClaimHost}
            disabled={claiming}
          >
            {claiming ? "Claiming…" : "Claim Host"}
          </button>
          <p className="muted" style={{ marginTop: "0.25rem" }}>
            If the host doesn’t show up, you can claim host status after the
            grace period to continue the ride.
          </p>
        </div>
      )}
    </div>
  );
}
