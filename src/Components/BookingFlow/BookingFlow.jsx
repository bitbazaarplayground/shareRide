// src/Components/BookingFlow/BookingFlow.jsx
import { useEffect, useMemo, useState } from "react";
import useBookingStatus from "../../hooks/useBookingStatus";
import "./booking-flow.css";

const BACKEND = import.meta.env.VITE_STRIPE_BACKEND;
const DEFAULT_GRACE_SECONDS = 360; // 6 minutes

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

function useCountdown(targetIso) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return { secondsLeft: 0, expired: true };
  const diffMs = new Date(targetIso).getTime() - now;
  const secondsLeft = Math.max(0, Math.floor(diffMs / 1000));
  return { secondsLeft, expired: secondsLeft <= 0 };
}

export default function BookingFlow({ rideId, userId, isAuthenticated }) {
  const { loading, error, data, refresh } = useBookingStatus(
    rideId,
    userId,
    5000
  );

  // We expose booker-only controls, check-in, claim, and uber button conditionally
  const {
    status,
    isBooker,
    minContributors,
    paidCount,
    checkedInCount,
    codeActive,
    codeExpiresAt,
    codeIssuedAt, // make sure your /booking-status includes this field as suggested
  } = data || {};

  const [issuing, setIssuing] = useState(false);
  const [issuedCode, setIssuedCode] = useState(null); // we only know code at issuance time
  const [ttl, setTtl] = useState(600); // seconds
  const [codeInput, setCodeInput] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [uberLoading, setUberLoading] = useState(false);

  const { secondsLeft, expired } = useCountdown(codeExpiresAt);

  // Compute when claiming is allowed
  const claimAllowedAt = useMemo(() => {
    if (!codeIssuedAt) return null;
    const base = new Date(codeIssuedAt).getTime();
    return new Date(base + DEFAULT_GRACE_SECONDS * 1000).toISOString();
  }, [codeIssuedAt]);

  const { secondsLeft: claimS, expired: claimWindowOpen } =
    useCountdown(claimAllowedAt);

  const canIssueCode =
    isBooker && (status === "bookable" || status === "checking_in");

  const canCheckIn =
    !isBooker &&
    (status === "checking_in" || status === "ready_to_book") &&
    codeActive &&
    !expired;

  const canClaimBooker =
    !isBooker &&
    (status === "checking_in" || status === "ready_to_book") &&
    checkedInCount >= (minContributors || 2) &&
    (claimWindowOpen || !claimAllowedAt); // if backend didn’t send codeIssuedAt, let backend enforce

  const canOpenUber = isBooker && status === "ready_to_book"; // only booker when ready

  const handleIssueCode = async () => {
    if (!isAuthenticated) return alert("Please sign in.");
    setIssuing(true);
    try {
      const json = await postJSON(`${BACKEND}/api/rides/${rideId}/issue-code`, {
        userId,
        ttlSeconds: Number(ttl),
      });
      // We only learn the code at issuance time
      setIssuedCode(json.code);
      await refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setIssuing(false);
    }
  };

  const handleCheckIn = async () => {
    if (!isAuthenticated) return alert("Please sign in.");
    if (!/^\d{6}$/.test(codeInput)) {
      return alert("Enter the 6-digit code.");
    }
    setCheckingIn(true);
    try {
      let lat = null,
        lng = null;
      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          // ignore if denied
        }
      }
      await postJSON(`${BACKEND}/api/rides/${rideId}/check-in`, {
        userId,
        code: codeInput,
        lat,
        lng,
      });
      setCodeInput("");
      await refresh();
    } catch (e) {
      alert(e.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleClaimBooker = async () => {
    if (!isAuthenticated) return alert("Please sign in.");
    setClaiming(true);
    try {
      await postJSON(`${BACKEND}/api/rides/${rideId}/claim-booker`, {
        userId,
        graceSeconds: DEFAULT_GRACE_SECONDS,
      });
      await refresh();
    } catch (e) {
      // backend returns claimAllowedAt if too early
      alert(e.message);
    } finally {
      setClaiming(false);
    }
  };

  const handleOpenUber = async () => {
    setUberLoading(true);
    try {
      const res = await fetch(
        `${BACKEND}/api/rides/${rideId}/uber-link?userId=${encodeURIComponent(userId || "")}`
      );
      const json = await res.json();

      if (!res.ok) {
        console.error("Uber deep link error:", json.error);
        alert(json.error || "Failed to get Uber link.");
        return;
      }

      if (!json.url) {
        console.warn("No Uber link received.");
        alert("Sorry, something went wrong. Please try again.");
        return;
      }

      // Optional analytics (e.g., Mixpanel, GTM, etc.)
      if (window.analytics?.track) {
        window.analytics.track("Opened Uber Link", {
          rideId,
          userId,
        });
      }

      window.location.href = json.url;
    } catch (e) {
      console.error("Uber link error:", e);
      alert("Could not open Uber. Please try again.");
    } finally {
      setUberLoading(false);
    }
  };

  if (loading) return <div className="bf-box">Loading booking status…</div>;
  if (error) return <div className="bf-box error">Error: {error}</div>;
  if (!data?.exists) return <div className="bf-box">No pool yet.</div>;

  return (
    <div className="bf-wrap">
      <div className="bf-badges">
        <span className={`bf-badge s-${status}`}>Status: {status}</span>
        <span className="bf-badge">Paid: {paidCount}</span>
        <span className="bf-badge">Checked-in: {checkedInCount}</span>
        <span className="bf-badge">Min: {minContributors || 2}</span>
        {isBooker ? (
          <span className="bf-badge booker">You are the booker</span>
        ) : (
          <span className="bf-badge">Not booker</span>
        )}
      </div>

      {/* Booker: issue code */}
      {canIssueCode && (
        <div className="bf-box">
          <h3>Start group check-in (booker)</h3>
          <div className="bf-row">
            <label htmlFor="ttl">Code timeout (sec):</label>
            <input
              id="ttl"
              type="number"
              min={120}
              max={1800}
              step={30}
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
            />
            <button onClick={handleIssueCode} disabled={issuing}>
              {issuing ? "Issuing…" : "Issue Code"}
            </button>
          </div>

          {(issuedCode || codeActive) && (
            <div className="bf-row">
              <div className="bf-code">
                <div className="bf-code-label">6-digit code</div>
                <div className="bf-code-value">
                  {issuedCode ? issuedCode : "Active (reissue to display)"}
                </div>
              </div>
              <div className="bf-countdown">
                {codeActive && !expired ? (
                  <span>
                    Expires in <strong>{secondsLeft}s</strong>
                  </span>
                ) : (
                  <span className="muted">No active code</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Participant: check in */}
      {canCheckIn && (
        <div className="bf-box">
          <h3>Check-in with code</h3>
          <div className="bf-row">
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="Enter 6-digit code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ""))}
            />
            <button
              onClick={handleCheckIn}
              disabled={checkingIn || !/^\d{6}$/.test(codeInput)}
            >
              {checkingIn ? "Checking in…" : "Check in"}
            </button>
          </div>
          {expired && (
            <p className="muted">
              Code expired. Ask the booker to issue a new one.
            </p>
          )}
        </div>
      )}

      {/* Non-booker: claim booker after grace time if quorum met */}
      {canClaimBooker && (
        <div className="bf-box">
          <h3>Booker absent?</h3>
          {claimAllowedAt && !claimWindowOpen ? (
            <p className="muted">
              You can claim booker in <strong>{claimS}s</strong>.
            </p>
          ) : (
            <button onClick={handleClaimBooker} disabled={claiming}>
              {claiming ? "Claiming…" : "Claim Booker Role"}
            </button>
          )}
          <p className="fineprint">
            Only <strong>paid & checked-in</strong> riders can claim. Requires
            at least <strong>{minContributors || 2}</strong> checked-in.
          </p>
        </div>
      )}

      {/* Booker: open Uber when ready */}
      {canOpenUber && (
        <div className="bf-box">
          <h3>Ready to book</h3>
          <button
            className="uber-btn"
            onClick={handleOpenUber}
            disabled={uberLoading}
          >
            {uberLoading ? "Opening…" : "Open Uber"}
          </button>
        </div>
      )}
    </div>
  );
}
