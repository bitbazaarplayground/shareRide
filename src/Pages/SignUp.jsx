import React, { useState } from "react";
import { FaApple, FaFacebookF, FaGoogle, FaInstagram } from "react-icons/fa";
import { supabase } from "../supabaseClient";
import "./StylesPages/SignUp.css";

export default function SignUp() {
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [interests, setInterests] = useState("");
  const [message, setMessage] = useState("");

  const handleSignUp = async (e) => {
    e.preventDefault();
    setMessage("");

    if (isNaN(age) || age < 13) {
      setMessage("You must be at least 13 years old.");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes("already registered") ||
          error.status === 400
        ) {
          setMessage("An account with this email already exists.");
        } else {
          setMessage(error.message);
        }
        return;
      }

      const user = data?.user;

      if (user) {
        const { error: insertError } = await supabase.from("profiles").insert([
          {
            id: user.id,
            name,
            nickname,
            age,
            interests,
            email,
          },
        ]);

        if (insertError) {
          throw insertError;
        }

        setMessage(
          `Thanks for signing up, ${
            name || "friend"
          }! Please check your email to confirm your account.`
        );
      }
    } catch (err) {
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  const handleOAuthSignup = async (provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo:
          "https://bitbazaarplayground.github.io/shareRide/auth/callback",
      },
    });

    if (error) {
      setMessage(error.message || "OAuth sign-up failed.");
    }
  };

  return (
    <div className="signup-container">
      <h2>Create an Account</h2>
      <form onSubmit={handleSignUp} className="signup-form">
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
          min="13"
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
        <textarea
          placeholder="Tell us about your interests"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          rows={3}
        />
        <button type="submit" className="signup-btn">
          Sign Up
        </button>
      </form>

      <div className="social-icons">
        <p>Or sign up with:</p>
        <button
          className="social-btn google"
          onClick={() => handleOAuthSignup("google")}
        >
          <FaGoogle size={24} color="#DB4437" />
        </button>
        <button
          className="social-btn facebook"
          onClick={() => handleOAuthSignup("facebook")}
        >
          <FaFacebookF size={24} color="#1877F2" />
        </button>
        <button
          className="social-btn instagram"
          onClick={() => setMessage("Instagram sign-up not yet implemented.")}
        >
          <FaInstagram size={24} color="#E4405F" />
        </button>
        <button
          className="social-btn apple"
          onClick={() => setMessage("Apple sign-up not yet implemented.")}
        >
          <FaApple size={24} color="#333" />
        </button>
      </div>

      {message && <p className="message">{message}</p>}
    </div>
  );
}
