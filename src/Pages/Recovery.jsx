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
    const run = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data?.session) {
        setMessage("❌ Recovery link is invalid or expired.");
        return;
      }

      setMode("reset");
      setMessage("");
    };
    run();
  }, []);

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
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 2000);
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
          {loading ? "Updating..." : "Update Password"}
        </button>
        {message && (
          <p style={{ color: message.startsWith("✅") ? "green" : "crimson" }}>
            {message}
          </p>
        )}
      </form>
    );
  }

  return <p style={{ padding: "2rem" }}>{message}</p>;
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
