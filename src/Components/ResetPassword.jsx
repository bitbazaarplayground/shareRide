import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || session.user?.app_metadata.provider !== "email") {
        setMessage("Invalid or expired reset link.");
        return;
      }

      setConfirmed(true);
    };

    checkSession();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated! Redirecting...");
      setTimeout(() => navigate("/"), 2000);
    }
  };

  if (!confirmed) return <p>{message || "Checking..."}</p>;

  return (
    <form onSubmit={handleUpdate}>
      <h2>Reset Password</h2>
      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Update Password</button>
      {message && <p>{message}</p>}
    </form>
  );
}
