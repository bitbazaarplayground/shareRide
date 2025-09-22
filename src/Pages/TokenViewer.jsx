import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function TokenViewer() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        console.error("Error getting session:", error);
        return;
      }
      if (session) {
        setToken(session.access_token);
        setEmail(session.user.email);
      } else {
        setToken("❌ No session. Please log in first.");
      }
    })();
  }, []);

  return (
    <div
      style={{ maxWidth: "800px", margin: "2rem auto", textAlign: "center" }}
    >
      <h2>🔑 Token Viewer (temporary)</h2>
      <p>
        Logged in as: <strong>{email || "Not logged in"}</strong>
      </p>
      <textarea
        readOnly
        value={token}
        style={{ width: "100%", height: "150px", marginTop: "1rem" }}
      />
      <p style={{ marginTop: "1rem", color: "red" }}>
        ⚠️ Copy this token into Postman (Bearer Token auth). <br />
        Remove <code>TokenViewer.jsx</code> after testing to keep your app
        secure.
      </p>
    </div>
  );
}
