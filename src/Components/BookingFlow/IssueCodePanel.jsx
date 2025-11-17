// src/Components/BookingFlow/IssueCodePanel.jsx
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import useBookingStatus from "../../hooks/useBookingStatus";
import { supabase } from "../../supabaseClient";

export default function IssueCodePanel({ rideId, user }) {
  const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;
  const userId = user?.id;
  const { status, loading, refresh } = useBookingStatus(rideId, userId, {
    pollMs: 8000,
  });

  // host-only TTL (start check-in window)
  const [ttl, setTtl] = useState(600);
  const [busy, setBusy] = useState(false);

  // passenger-only code + expiry
  const [myCode, setMyCode] = useState(null);
  const [myExpiresAt, setMyExpiresAt] = useState(null);

  // countdown (works for either host’s window or passenger’s code)
  const [countdown, setCountdown] = useState(null);

  // ---- gating for host (booker) ----
  const enoughPaid = (status?.paidSeats || 0) >= 2; // host + ≥1 rider
  const hostCanStartWindow =
    !loading &&
    status?.exists &&
    status?.isBooker &&
    enoughPaid &&
    ["bookable", "checking_in"].includes(status.status);

  // ---- passenger: fetch my personal code ----
  useEffect(() => {
    const run = async () => {
      if (!userId || !rideId || status?.isBooker) {
        // host doesn't need personal code in this panel
        setMyCode(null);
        setMyExpiresAt(null);
        return;
      }

      // 1) find pool for this ride
      const { data: pool, error: pErr } = await supabase
        .from("ride_pools")
        .select("id")
        .eq("ride_id", rideId)
        .maybeSingle();

      if (pErr || !pool?.id) {
        setMyCode(null);
        setMyExpiresAt(null);
        return;
      }

      // 2) get my contribution code + expiry
      const { data: contrib, error: cErr } = await supabase
        .from("ride_pool_contributions")
        .select("booking_code, code_expires_at")
        .eq("ride_pool_id", pool.id)
        .eq("user_id", userId)
        .eq("status", "paid")
        .maybeSingle();

      if (cErr || !contrib) {
        setMyCode(null);
        setMyExpiresAt(null);
        return;
      }

      setMyCode(contrib.booking_code || null);
      setMyExpiresAt(contrib.code_expires_at || null);
    };

    run();
  }, [userId, rideId, status?.isBooker]);

  // ---- countdown driver ----
  const expiresAt = status?.isBooker
    ? status?.codeExpiresAt
      ? new Date(status.codeExpiresAt)
      : null
    : myExpiresAt
    ? new Date(myExpiresAt)
    : null;

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

  const copyToClipboard = (text) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.info("Code copied to clipboard!"))
      .catch(() => toast.error("Failed to copy code"));
  };

  // ---- host action: start check-in window (no code here) ----
  const onStartCheckin = async () => {
    if (!BACKEND) {
      toast.error("Backend not configured.");
      return;
    }
    setBusy(true);
    try {
      // hit your backend route that opens the check-in window
      // (same route you previously used to issue a single code; now it should
      // just set code_issued_at/code_expires_at for the window)
      const res = await fetch(`${BACKEND}/api/rides/${rideId}/start-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ttlSeconds: ttl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start check-in");

      toast.success(
        `Check-in window started. Expires at ${new Date(
          json.expiresAt
        ).toLocaleTimeString()}`
      );
      refresh();
    } catch (e) {
      console.error(e);
      toast.error(e.message || "Failed to start check-in");
    } finally {
      setBusy(false);
    }
  };

  // ---- Render ----
  // If host can start window: show host UI
  if (hostCanStartWindow) {
    return (
      <div className="issue-code-panel">
        <h4>Check-in Window</h4>
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
            <button className="btn" onClick={onStartCheckin} disabled={busy}>
              {busy ? "Starting…" : "Start check-in"}
            </button>
          </>
        )}
      </div>
    );
  }

  // If not host: show passenger’s personal code (if any)
  if (!status?.isBooker) {
    // Only show something after ride is confirmed or checking_in
    const canShow =
      status?.exists && ["confirmed", "checking_in"].includes(status.status);

    if (!canShow) return null;

    return (
      <div className="issue-code-panel">
        <h4>Your Booking Code</h4>
        {myCode ? (
          <p>
            <strong>{myCode}</strong>
            <br />
            <small className="muted">
              {countdown != null && countdown > 0
                ? `Expires in ${Math.floor(countdown / 60)}m ${
                    countdown % 60
                  }s.`
                : "Expiring soon…"}
              <br />
              Share this code only when you meet your host.
            </small>
            <br />
            <button
              className="btn btn-small"
              style={{ marginTop: 8 }}
              onClick={() => copyToClipboard(myCode)}
            >
              Copy Code
            </button>
          </p>
        ) : (
          <p className="muted">
            Your personal check-in code will appear here once the host starts
            check-in.
          </p>
        )}
      </div>
    );
  }

  // Fallback (no UI)
  return null;
}
