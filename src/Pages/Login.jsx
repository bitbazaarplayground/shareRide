// Pages/Login.jsx
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import React, { useState } from "react";
import { FaApple, FaFacebookF, FaGoogle, FaInstagram } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import "./StylesPages/Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");

    try {
      if (rememberMe) {
        await setPersistence(auth, browserLocalPersistence);
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("User logged in:", userCredential.user);
      setMessage("Login successful!");
      navigate("/profile"); // 👈 Redirect after login
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handleSocialLogin = async (provider) => {
    try {
      await signInWithPopup(auth, provider);
      navigate("/profile"); // 👈 Redirect after social login
    } catch (err) {
      setMessage(err.message);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage("Enter your email first to reset password.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset link sent to your email.");
    } catch (err) {
      setMessage(err.message);
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

        <label className="remember-me">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={() => setRememberMe(!rememberMe)}
          />
          Remember me
        </label>

        <button className="login-btn" type="submit">
          Log In
        </button>

        <button
          type="button"
          className="reset-btn"
          onClick={handlePasswordReset}
        >
          Forgot Password?
        </button>
      </form>

      <div className="social-login">
        <p>Or log in with:</p>
        <div className="social-icons">
          <button
            className="social-btn google"
            onClick={() => handleSocialLogin(new GoogleAuthProvider())}
          >
            <FaGoogle size={24} color="#DB4437" />
          </button>

          <button
            className="social-btn facebook"
            onClick={() => handleSocialLogin(new FacebookAuthProvider())}
          >
            <FaFacebookF size={24} color="#1877F2" />
          </button>

          <button
            className="social-btn instagram"
            disabled
            title="Not supported"
          >
            <FaInstagram size={24} color="#E4405F" />
          </button>

          <button className="social-btn apple" disabled title="Not supported">
            <FaApple size={24} color="#333" />
          </button>
        </div>
      </div>

      {message && <p className="message">{message}</p>}
    </div>
  );
}
