// src/Pages/Login.jsx
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { FaApple, FaFacebookF, FaGoogle, FaInstagram } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./StylesPages/Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setMessage("❌ " + error.message);
      else {
        setMessage("✅ Login successful!");
        setTimeout(() => navigate("/"), 800);
      }
    } catch {
      setMessage("❌ Something went wrong. Try again.");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) setMessage("❌ " + error.message);
    } catch {
      setMessage("❌ Something went wrong.");
    }
  };

  const handleFacebookLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
      });
      if (error) setMessage("❌ " + error.message);
    } catch {
      setMessage("❌ Something went wrong.");
    }
  };

  const handleForgotPassword = async () => {
    const userEmail = prompt("Please enter your email to reset your password:");
    if (!userEmail) return;
    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${window.location.origin}/recovery`,
    });
    setMessage(
      error
        ? "❌ " + error.message
        : "✅ Password reset email sent! Check your inbox."
    );
  };

  return (
    <div className="login-page">
      <Helmet>
        <meta name="robots" content="noindex,follow" />
        <title>Log in — TabFair</title>
        <meta
          name="description"
          content="Log in to TabFair to post rides, search rides, and manage your account."
        />
        <link
          rel="canonical"
          href="https://jade-rolypoly-5d4274.netlify.app/login"
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Log in — TabFair" />
        <meta
          property="og:description"
          content="Access your TabFair account to post or find shared taxi rides."
        />
        <meta
          property="og:image"
          content="https://jade-rolypoly-5d4274.netlify.app/og-image.jpg"
        />
        <meta
          property="og:url"
          content="https://jade-rolypoly-5d4274.netlify.app/login"
        />
      </Helmet>

      <div className="login-container">
        <h2>Login</h2>

        <form className="login-form" onSubmit={handleLogin}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button className="login-submit-btn" type="submit">
            Log In
          </button>
        </form>

        <div className="login-social-login">
          <p>Or log in with:</p>
          <div className="login-social-icons">
            <button
              type="button"
              className="login-social-btn google"
              onClick={handleGoogleLogin}
              aria-label="Continue with Google"
            >
              <FaGoogle size={24} color="#DB4437" />
            </button>
            <button
              type="button"
              className="login-social-btn facebook"
              onClick={handleFacebookLogin}
              aria-label="Continue with Facebook"
            >
              <FaFacebookF size={24} color="#1877F2" />
            </button>
            <button
              type="button"
              className="login-social-btn instagram"
              title="Instagram not supported"
              disabled
            >
              <FaInstagram size={24} color="#E4405F" />
            </button>
            <button
              type="button"
              className="login-social-btn apple"
              onClick={() => alert("Apple login not implemented yet.")}
            >
              <FaApple size={24} color="#333" />
            </button>
          </div>
        </div>

        <p className="forgot-password">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="linklike"
          >
            Forgot your password?
          </button>
        </p>

        <p className="signup-redirect">
          Don’t have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="signup-link"
          >
            Sign up
          </button>
        </p>

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
}
