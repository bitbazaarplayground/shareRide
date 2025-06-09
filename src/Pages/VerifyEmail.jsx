import { getAuth, onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import app from "../firebase"; // make sure this is your Firebase app initialization

export default function VerifyEmail() {
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth(app);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (user.emailVerified) {
          // User's email is verified
          navigate("/complete-profile");
        } else {
          console.log("User signed in but email is not verified.");
        }
      } else {
        console.log("No user is signed in.");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h2>✅ Email Verification</h2>
      <p>Checking your verification status. Please wait...</p>
    </div>
  );
}
