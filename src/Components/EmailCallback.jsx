import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function EmailCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const confirmUser = async () => {
      const { error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );
      if (error) {
        console.error("Email confirmation failed:", error.message);
        alert("Confirmation link is invalid or expired.");
      } else {
        alert("✅ Email confirmed! Welcome.");
        navigate("/complete-profile");
      }
    };

    confirmUser();
  }, []);

  return <p>Confirming your email...</p>;
}
