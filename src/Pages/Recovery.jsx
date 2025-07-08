import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Recovery() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        // ✅ Logged in from recovery link
        navigate("/account"); // or "/reset-password"
      } else {
        console.error("No active session.");
      }
    };

    checkSession();
  }, [navigate]);

  return <p style={{ padding: "2rem" }}>Redirecting...</p>;
}
