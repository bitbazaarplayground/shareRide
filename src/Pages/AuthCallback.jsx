// src/Pages/AuthCallback.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuth = async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        console.error("Error exchanging code for session:", error.message);
        navigate("/login");
        return;
      }

      const user = data.session.user;

      const { data: existingProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!existingProfile) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || "",
          avatar_url: user.user_metadata?.avatar_url || "",
        });

        if (insertError) {
          console.error("Error creating profile:", insertError.message);
        }

        navigate("/complete-profile");
      } else if (!existingProfile.nickname) {
        navigate("/complete-profile");
      } else {
        navigate("/");
      }
    };

    handleAuth();
  }, [navigate]);

  return <p>Logging in...</p>;
}
