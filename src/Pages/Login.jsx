// src/Pages/Login.jsx
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { FaApple, FaFacebookF, FaGoogle, FaInstagram } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./StylesPages/Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Runtime guard: make it obvious if Netlify envs are missing
  const envOK = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    return Boolean(url && key);
  }, []);

  const AUTH_TIMEOUT_MS = 10_000;
  const withTimeout = (p, label) =>
    Promise.race([
      p,
      new Promise((_, rej) =>
        setTimeout(
          () => rej(new Error(`${label} timed out after ${AUTH_TIMEOUT_MS}ms`)),
          AUTH_TIMEOUT_MS
        )
      ),
    ]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    console.log(
      "[Login] Attempting login to:",
      import.meta.env.VITE_SUPABASE_URL
    );

    if (!envOK) {
      setMessage(
        "❌ Missing Supabase env vars. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY on Netlify."
      );
      console.error("Supabase envs", {
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
      });
      return;
    }

    const emailTrim = email.trim();
    const pwd = password;
    if (!emailTrim || !pwd) {
      setMessage("❌ Please enter email and password.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email: emailTrim, password: pwd }),
        "Login"
      );

      console.log("[Login] signInWithPassword result:", {
        userId: data?.user?.id,
        hasSession: !!data?.session,
        error,
      });
      if (error) {
        setMessage(
          `❌ ${error.message}${error.status ? ` (code ${error.status})` : ""}`
        );
        return;
      }
      if (!data?.session) {
        setMessage("❌ No session returned. Please try again.");
        return;
      }
      setMessage("✅ Login successful!");
      setTimeout(() => navigate("/"), 600);
    } catch (err) {
      console.error("[Login] Exception:", err);

      const msg = err?.message?.includes("timed out")
        ? "❌ No response from auth server. Check network/ad-blockers and try again."
        : "❌ Something went wrong. Please try again.";
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        console.error("Google OAuth error:", error);
        setMessage(`❌ ${error.message}`);
      }
    } catch (err) {
      console.error("Google OAuth exception:", err);
      setMessage("❌ Something went wrong.");
    }
  };

  const handleFacebookLogin = async () => {
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });
      if (error) {
        console.error("Facebook OAuth error:", error);
        setMessage(`❌ ${error.message}`);
      }
    } catch (err) {
      console.error("Facebook OAuth exception:", err);
      setMessage("❌ Something went wrong.");
    }
  };

  const handleForgotPassword = async () => {
    const userEmail = prompt("Please enter your email to reset your password:");
    if (!userEmail) return;
    const { error } = await supabase.auth.resetPasswordForEmail(
      userEmail.trim(),
      {
        redirectTo: `${window.location.origin}/recovery`,
      }
    );
    setMessage(
      error
        ? `❌ ${error.message}`
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

        {!envOK && (
          <p className="message" style={{ color: "#b00020" }}>
            ❌ Missing Supabase env vars. Set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> in Netlify & redeploy.
          </p>
        )}

        <form className="login-form" onSubmit={handleLogin} noValidate>
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

          <button className="login-submit-btn" type="submit" disabled={loading}>
            {loading ? "Logging in…" : "Log In"}
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
              disabled={loading}
            >
              <FaGoogle size={24} color="#DB4437" />
            </button>
            <button
              type="button"
              className="login-social-btn facebook"
              onClick={handleFacebookLogin}
              aria-label="Continue with Facebook"
              disabled={loading}
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
              disabled={loading}
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
            disabled={loading}
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
