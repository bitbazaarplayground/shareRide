// src/Pages/SignUp.jsx
import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { FaApple, FaFacebookF, FaGoogle, FaInstagram } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import "./StylesPages/SignUp.css";

export default function SignUp() {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setMessage("");

    const ageNum = parseInt(age, 10);
    if (Number.isNaN(ageNum) || ageNum < 18) {
      setMessage("You must be at least 18 years old.");
      return;
    }
    if (!termsAccepted) {
      setMessage("Please accept the Terms and Conditions.");
      return;
    }

    try {
      const {
        data: { user },
        error: signUpError,
      } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setMessage(signUpError.message);
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: user.id,
          name,
          nickname,
          age: ageNum,
          role: "user",
        },
      ]);
      if (profileError) {
        console.error("Error saving profile:", profileError.message);
        setMessage("Signup succeeded but saving your profile failed.");
        return;
      }

      setMessage(
        "Signup successful! Check your email to confirm your account."
      );
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  const handleOAuthSignup = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) setMessage(error.message || "OAuth sign-up failed.");
    } catch {
      setMessage("OAuth sign-up failed.");
    }
  };

  return (
    <div className="login-page">
      <Helmet>
        <meta name="robots" content="noindex,follow" />
        <title>Create account — TabFair</title>
        <meta
          name="description"
          content="Create your TabFair account to post rides, find shared taxis, and save money on travel."
        />
        <link
          rel="canonical"
          href="https://jade-rolypoly-5d4274.netlify.app/signup"
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Create account — TabFair" />
        <meta
          property="og:description"
          content="Join TabFair to share taxi rides, split fares, and travel smarter."
        />
        <meta
          property="og:image"
          content="https://jade-rolypoly-5d4274.netlify.app/og-image.jpg"
        />
        <meta
          property="og:url"
          content="https://jade-rolypoly-5d4274.netlify.app/signup"
        />
      </Helmet>

      <div className="login-container">
        <h2>Create an Account</h2>

        <form onSubmit={handleSignUp} className="login-form">
          <input
            type="text"
            placeholder="Full Name"
            aria-label="Full Name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Nickname (optional)"
            aria-label="Nickname"
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <input
            type="number"
            placeholder="Age"
            aria-label="Age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min="18"
            max="120"
            required
          />
          <input
            type="email"
            placeholder="Email"
            aria-label="Email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            aria-label="Password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          <div className="terms-checkbox">
            <label>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={() => setTermsAccepted(!termsAccepted)}
              />
              I accept the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms and Conditions
              </a>
            </label>
          </div>

          <button type="submit" className="login-btn">
            Sign Up
          </button>
        </form>

        <div className="social-login">
          <p>Or sign up with:</p>
          <div className="login-social-icons">
            <button
              type="button"
              className="login-social-btn"
              onClick={() => handleOAuthSignup("google")}
              disabled={!termsAccepted}
              aria-disabled={!termsAccepted}
              aria-label="Sign up with Google"
              title={
                !termsAccepted ? "Please accept Terms & Conditions" : "Google"
              }
            >
              <FaGoogle size={24} color="#DB4437" />
            </button>

            <button
              type="button"
              className="login-social-btn"
              onClick={() => handleOAuthSignup("facebook")}
              disabled={!termsAccepted}
              aria-disabled={!termsAccepted}
              aria-label="Sign up with Facebook"
              title={
                !termsAccepted ? "Please accept Terms & Conditions" : "Facebook"
              }
            >
              <FaFacebookF size={24} color="#1877F2" />
            </button>

            <button
              type="button"
              className="login-social-btn"
              title="Instagram not yet available"
              disabled
            >
              <FaInstagram size={24} color="#E4405F" />
            </button>

            <button
              type="button"
              className="login-social-btn"
              title="Apple not yet available"
              disabled
            >
              <FaApple size={24} color="#333" />
            </button>
          </div>
        </div>

        {message && <p className="message">{message}</p>}
      </div>
    </div>
  );
}
