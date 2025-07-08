import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Recovery() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mode, setMode] = useState("checking");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setMode("reset");
      } else {
        setMessage("Invalid or expired recovery link.");
        setMode("error");
      }
    };

    checkSession();
  }, []);

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage("❌ " + error.message);
    } else {
      setMessage("✅ Password updated! Redirecting...");
      setTimeout(() => navigate("/login"), 2000);
    }

    setLoading(false);
  };

  if (mode === "checking") {
    return <p style={{ padding: "2rem" }}>Verifying recovery link...</p>;
  }

  if (mode === "reset") {
    return (
      <form onSubmit={handleReset} style={{ padding: "2rem" }}>
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
          {loading ? "Updating..." : "Update Password"}
        </button>
        <p>{message}</p>
      </form>
    );
  }

  return <p style={{ padding: "2rem", color: "crimson" }}>{message}</p>;
}
