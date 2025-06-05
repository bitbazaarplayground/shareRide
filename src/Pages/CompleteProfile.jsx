import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./StylesPages/CompleteProfile.css";

export default function CompleteProfile() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    name: "",
    nickname: "",
    avatar_url: "",
    age: "",
    interests: [], // ✅ initialize as empty array
  });

  const [newInterest, setNewInterest] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, nickname, avatar_url, age, interests")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error.message);
      } else if (data) {
        setProfile({
          name: data.name || "",
          nickname: data.nickname || "",
          avatar_url: data.avatar_url || "",
          age: data.age || "",
          interests: Array.isArray(data.interests) ? data.interests : [], // ✅ safeguard
        });
      }
    };

    if (user) fetchProfile();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddInterest = () => {
    const trimmed = newInterest.trim();
    if (trimmed && !profile.interests.includes(trimmed)) {
      setProfile((prev) => ({
        ...prev,
        interests: [...prev.interests, trimmed],
      }));
      setNewInterest("");
    }
  };

  const handleRemoveInterest = (indexToRemove) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.filter((_, i) => i !== indexToRemove),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        ...profile,
        interests: profile.interests, // ✅ stored as JSON array
        role: "user",
      })
      .eq("id", user.id);

    setLoading(false);

    if (error) {
      console.error("Error updating profile:", error.message);
      alert("There was a problem updating your profile.");
    } else {
      alert("Profile completed successfully!");
      navigate("/profile");
    }
  };

  return (
    <div className="complete-profile-container">
      <h2>Complete Your Profile</h2>
      <form onSubmit={handleSubmit}>
        <label>Name:</label>
        <input
          type="text"
          name="name"
          value={profile.name}
          required
          onChange={handleInputChange}
        />

        <label>Nickname:</label>
        <input
          type="text"
          name="nickname"
          value={profile.nickname}
          required
          onChange={handleInputChange}
        />

        <label>Avatar URL (optional):</label>
        <input
          type="url"
          name="avatar_url"
          value={profile.avatar_url}
          onChange={handleInputChange}
          placeholder="https://example.com/avatar.jpg"
        />

        <label>Age:</label>
        <input
          type="number"
          name="age"
          value={profile.age}
          required
          min="0"
          onChange={handleInputChange}
        />

        <label>Interests:</label>
        <div className="interest-list">
          {profile.interests.map((interest, index) => (
            <div key={index} className="interest-chip">
              {interest}
              <button type="button" onClick={() => handleRemoveInterest(index)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="interest-input">
          <input
            type="text"
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            placeholder="Add an interest"
          />
          <button
            type="button"
            onClick={handleAddInterest}
            disabled={!newInterest.trim()}
          >
            Add
          </button>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save & Continue"}
        </button>
      </form>
    </div>
  );
}
