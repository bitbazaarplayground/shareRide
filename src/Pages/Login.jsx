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

  //   const handleSocialLogin = async (provider) => {
  //     const { error } = await supabase.auth.signInWithOAuth({ provider });
  //     if (error) {
  //       console.error(`Error logging in with ${provider}:`, error.message);
  //     }
  //   };

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

      <p className="message">{message}</p>
    </div>
  );
}
