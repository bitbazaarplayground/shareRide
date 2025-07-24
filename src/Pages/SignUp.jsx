import React, { useState } from "react";
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

    if (isNaN(age) || parseInt(age) < 18) {
      setMessage("You must be at least 18 years old.");
      return;
    }

    try {
      const {
        data: { user },
        error: signUpError,
      } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setMessage(signUpError.message);
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: user.id,
          name,
          nickname,
          age: parseInt(age),
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
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  const handleOAuthSignup = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/#/`,
      },
    });

    if (error) {
      setMessage(error.message || "OAuth sign-up failed.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h2>Create an Account</h2>
        <form onSubmit={handleSignUp} className="login-form">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Nickname (optional)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <input
            type="number"
            placeholder="Age"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            min="18"
            max="120"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" className="login-btn">
            Sign Up
          </button>
        </form>

        <div className="social-login">
          <p>Or sign up with:</p>
          <div className="login-social-icons">
            {["google", "facebook", "instagram", "apple"].map((provider) => {
              const icons = {
                google: <FaGoogle size={24} color="#DB4437" />,
                facebook: <FaFacebookF size={24} color="#1877F2" />,
                instagram: <FaInstagram size={24} color="#E4405F" />,
                apple: <FaApple size={24} color="#333" />,
              };

              const isDisabled = !termsAccepted;
              const handler =
                provider === "instagram" || provider === "apple"
                  ? () =>
                      setMessage(
                        `${
                          provider.charAt(0).toUpperCase() + provider.slice(1)
                        } sign-up not yet implemented.`
                      )
                  : () => handleOAuthSignup(provider);

              return (
                <div key={provider} className="tooltip-wrapper">
                  <button
                    className="login-social-btn"
                    onClick={handler}
                    disabled={isDisabled}
                  >
                    {icons[provider]}
                  </button>
                  {isDisabled && (
                    <span className="tooltip-text">
                      Please accept Terms & Conditions
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="terms-checkbox">
            <label>
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={() => setTermsAccepted(!termsAccepted)}
              />
              I accept the{" "}
              <a href="/Termsofuse" target="_blank" rel="noopener noreferrer">
                Terms and Conditions
              </a>
            </label>
          </div>

          {message && <p className="message">{message}</p>}
        </div>
      </div>
    </div>
  );
}
