import React, { useState } from "react";
import { FaApple, FaFacebookF, FaGoogle, FaInstagram } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./StylesPages/Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Login successful!");
        console.log("User:", data.user);
      }
    } catch (err) {
      setMessage("Something went wrong. Try again.");
    }
  };

  // Google OAuth login
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });
    if (error) setMessage(error.message);
  };

  const handleFacebookLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
    });
    if (error) setMessage(error.message);
  };

  const handleForgotPassword = async () => {
    const userEmail = prompt("Please enter your email to reset your password:");
    if (!userEmail) return;

    const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: "https://jade-rolypoly-5d4274.netlify.app/#/recovery",
    });

    if (error) {
      setMessage("❌ " + error.message);
    } else {
      setMessage("✅ Password reset email sent! Check your inbox.");
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>

      <form className="login-form" onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="login-btn" type="submit">
          Log In
        </button>
      </form>

      <div className="social-login">
        <p>Or log in with:</p>
        <div className="social-icons">
          <button className="social-btn google" onClick={handleGoogleLogin}>
            <FaGoogle size={24} color="#DB4437" />
          </button>
          <button className="social-btn facebook" onClick={handleFacebookLogin}>
            <FaFacebookF size={24} color="#1877F2" />
          </button>
          <button
            className="social-btn instagram"
            title="Instagram not supported"
            disabled
          >
            <FaInstagram size={24} color="#E4405F" />
          </button>
          <button
            className="social-btn apple"
            onClick={() => handleSocialLogin("apple")}
          >
            <FaApple size={24} color="#333" />
          </button>
        </div>
      </div>
      <p className="forgot-password" onClick={() => handleForgotPassword()}>
        Forgot your password?
      </p>

      <p className="message">{message}</p>
    </div>
  );
}
