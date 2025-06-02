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
      } else {
        const user = data.session.user;

        // Insert profile row if it doesn't exist
        const { data: existingProfile, error: fetchError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (!existingProfile) {
          const { error: insertError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              email: user.email,
              name: user.user_metadata.name || "", // Google provides display name
              avatar_url: user.user_metadata.avatar_url || "",
            });

          if (insertError) {
            console.error("Error creating profile:", insertError.message);
          }
        }

        navigate("/profile");
      }
    };

    handleAuth();
  }, [navigate]);

  return <p>Logging in...</p>;
}
