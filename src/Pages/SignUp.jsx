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
    if (age && (isNaN(age) || age < 13)) {
      setMessage("You must be at least 13 years old.");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const user = data.user;

      // ✅ Add user to "profiles" table
      if (data?.user) {
        const { error: insertError } = await supabase.from("profiles").insert([
          {
            id: data.user.id, // this MUST match the uuid primary key in your profiles table
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
      }

      setMessage(`Thanks for signing up, ${name || "friend"}!`);
    } catch (error) {
      setMessage(error.message || "Something went wrong. Please try again.");
    }
  };
  const handleGoogleSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo:
          "https://bitbazaarplayground.github.io/shareRide/auth/callback",
      },
    });
    if (error) setMessage(error.message);
  };

  const handleFacebookSignup = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: {
        redirectTo:
          "https://bitbazaarplayground.github.io/shareRide/auth/callback",
      },
    });
    if (error) setMessage(error.message);
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
        <button className="social-btn google" onClick={handleGoogleSignup}>
          <FaGoogle size={24} color="#DB4437" />
        </button>
        <button className="social-btn facebook" onClick={handleFacebookSignup}>
          <FaFacebookF size={24} color="#1877F2" />
        </button>
        <button className="social-btn instagram">
          <FaInstagram size={24} color="#E4405F" />
        </button>
        <button className="social-btn apple">
          <FaApple size={24} color="#333" />
        </button>
      </div>

      {message && <p className="message">{message}</p>}
    </div>
  );
}
