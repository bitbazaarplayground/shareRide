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

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Session error:", error.message);
        setMessage("⚠️ Error checking session.");
        return;
      }

      if (data.session) {
        console.log("✅ Active recovery session found.");
        setMode("reset");
        setMessage("");
      } else {
        console.warn("❌ No valid recovery session.");
        setMessage("⚠️ Recovery session invalid or expired.");
      }
    };

    checkSession();
  }, []);

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("❌ Passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("Updating...");

    // Confirm active session before trying to update
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    console.log("🔍 Current session data:", sessionData);

    if (sessionError || !sessionData.session) {
      setMessage("❌ No active session. Please request a new recovery link.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      console.error("❌ updateUser error:", error.message);
      setMessage("❌ " + error.message);
    } else {
      setMessage("✅ Password updated! Redirecting to login...");
      setTimeout(() => {
        supabase.auth.signOut(); // Log the user out
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
        <button type="submit" disabled={loading} style={{ marginTop: "1rem" }}>
          {loading ? "Updating..." : "Update Password"}
        </button>
        {message && <p style={{ color: "crimson" }}>{message}</p>}
      </form>
    );
  }

  return <p style={{ padding: "2rem", color: "crimson" }}>{message}</p>;
}

// import { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { supabase } from "../supabaseClient";

// export default function Recovery() {
//   const [password, setPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");
//   const [message, setMessage] = useState("Processing recovery...");
//   const [mode, setMode] = useState("loading");
//   const [loading, setLoading] = useState(false);
//   const navigate = useNavigate();

//   useEffect(() => {
//     const run = async () => {
//       const { data, error } = await supabase.auth.getSession();

//       if (error) {
//         console.error("getSession error:", error.message);
//         setMessage("❌ Failed to get session.");
//         return;
//       }

//       if (data.session) {
//         setMode("reset");
//         setMessage("");
//       } else {
//         setMessage("⚠️ Recovery session invalid or expired.");
//       }
//     };
//     run();
//   }, []);

//   const handlePasswordUpdate = async (e) => {
//     e.preventDefault();

//     if (password !== confirmPassword) {
//       setMessage("❌ Passwords do not match.");
//       return;
//     }

//     setLoading(true);
//     setMessage("Updating...");

//     const { data, error } = await supabase.auth.updateUser({ password });

//     if (error) {
//       console.error("updateUser error:", error.message);
//       setMessage("❌ " + error.message);
//     } else {
//       console.log("✅ Password updated:", data);
//       setMessage("✅ Password updated! Redirecting...");
//       setTimeout(() => navigate("/account"), 2000);
//     }

//     setLoading(false);
//   };

//   if (mode === "reset") {
//     return (
//       <form onSubmit={handlePasswordUpdate} style={{ padding: "2rem" }}>
//         <h2>Reset Your Password</h2>
//         <input
//           type="password"
//           placeholder="New password"
//           value={password}
//           onChange={(e) => setPassword(e.target.value)}
//           required
//         />
//         <input
//           type="password"
//           placeholder="Confirm password"
//           value={confirmPassword}
//           onChange={(e) => setConfirmPassword(e.target.value)}
//           required
//         />
//         <button type="submit" disabled={loading}>
//           {loading ? "Updating..." : "Update Password"}
//         </button>
//         {message && (
//           <p style={{ color: message.includes("✅") ? "green" : "crimson" }}>
//             {message}
//           </p>
//         )}
//       </form>
//     );
//   }

//   return <p style={{ padding: "2rem" }}>{message}</p>;
// }
