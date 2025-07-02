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
    bio: "",
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("name, nickname, avatar_url, age, bio")
          .eq("id", user.id)
          .single();

        if (data) {
          setProfile({
            name: data.name || "",
            nickname: data.nickname || "",
            avatar_url: data.avatar_url || "",
            age: data.age || "",
            bio: data.bio || "",
          });

          if (data.avatar_url) setPreview(data.avatar_url);
        } else if (error) {
          console.error("Error fetching profile:", error.message);
        }
      } catch (err) {
        console.error("Unexpected error:", err.message);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !user) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("profilephotos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Upload failed:", uploadError.message);
      alert("Failed to upload image.");
      return;
    }

    const { data } = supabase.storage
      .from("profilephotos")
      .getPublicUrl(filePath);

    if (data?.publicUrl) {
      setProfile((prev) => ({ ...prev, avatar_url: data.publicUrl }));
      setPreview(data.publicUrl);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          ...profile,
          email: user.email,
          avatar_url: preview || profile.avatar_url,
        })
        .eq("id", user.id);

      if (error) {
        console.error("Error updating profile:", error.message);
        alert("There was a problem updating your profile.");
      } else {
        alert("Profile updated successfully!");
        navigate("/profile");
      }
    } catch (err) {
      console.error("Unexpected error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user || initialLoading) {
    return <p className="loading-message">Loading profile data...</p>;
  }

  return (
    <div className="complete-profile-container">
      <h2>Edit Your Profile</h2>
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

        <label>Photo:</label>
        {preview ? (
          <img src={preview} alt="Avatar preview" className="avatar-preview" />
        ) : (
          <div className="avatar-placeholder">No image selected</div>
        )}
        <input type="file" accept="image/*" onChange={handlePhotoChange} />

        <label>Age:</label>
        <input
          type="number"
          name="age"
          value={profile.age}
          required
          min="18"
          onChange={handleInputChange}
        />

        <label>About You:</label>
        <input
          type="text"
          name="bio"
          value={profile.bio}
          required
          onChange={handleInputChange}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
