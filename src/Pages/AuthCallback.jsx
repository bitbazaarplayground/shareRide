import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error("Error exchanging code for session:", error.message);
        navigate("/login"); // fallback if auth fails
      } else {
        navigate("/profile"); // go to profile after login
      }
    };

    handleAuth();
  }, [navigate]);

  return <p>Logging in...</p>;
}
