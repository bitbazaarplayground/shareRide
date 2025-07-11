import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Recovery() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("Processing recovery...");
  const [mode, setMode] = useState("loading");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 1. Confirm the user was auto-logged-in via email link
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        setMode("reset");
        setMessage("");
      } else {
        setMessage("⚠️ Session expired or invalid recovery link.");
      }
    };

    checkSession();
  }, []);

  // 2. Update password and then logout immediately
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("Updating...");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage("❌ " + error.message);
    } else {
      setMessage("✅ Password updated! Logging out...");
      await supabase.auth.signOut(); // Force logout

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    }

    setLoading(false);
  };

  if (mode === "reset") {
    return (
      <form onSubmit={handlePasswordUpdate} style={{ padding: "2rem" }}>
        <h2>Reset Your Password</h2>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "✅ Password updated!" : "Update Password"}
        </button>
        {message && (
          <p
            style={{
              color: message.startsWith("✅")
                ? "green"
                : message.startsWith("❌")
                  ? "crimson"
                  : "#333",
              marginTop: "1rem",
            }}
          >
            {message}
          </p>
        )}
      </form>
    );
  }

  return <p style={{ padding: "2rem", color: "crimson" }}>{message}</p>;
}
