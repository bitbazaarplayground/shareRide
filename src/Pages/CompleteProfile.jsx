// src/Pages/CompleteProfile.jsx
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import CropModal from "../Components/CropModal";
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
  const [cropFile, setCropFile] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
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
      setInitialLoading(false);
    };
    fetchProfile();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropFile(file);
      setShowCropModal(true);
    }
  };

  const handleCroppedUpload = async (croppedBlob) => {
    if (!user || !croppedBlob) return;

    const fileName = `${user.id}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("profilephotos")
      .upload(fileName, croppedBlob, {
        cacheControl: "3600",
        upsert: true,
        contentType: "image/jpeg",
      });

    if (uploadError) {
      console.error("Image upload error:", uploadError.message);
      alert("Failed to upload image.");
      return;
    }

    const { data } = supabase.storage
      .from("profilephotos")
      .getPublicUrl(fileName);

    if (data?.publicUrl) {
      setProfile((prev) => ({ ...prev, avatar_url: data.publicUrl }));
      setPreview(data.publicUrl);
    }

    setShowCropModal(false);
    setCropFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
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
    setLoading(false);
  };

  if (!user || initialLoading) {
    return <p className="loading-message">Loading profile data...</p>;
  }

  return (
    <div className="complete-profile-container">
      <Helmet>
        <meta name="robots" content="noindex,follow" />
        <title>Complete your profile — TabFair</title>
        <meta
          name="description"
          content="Add your name, photo, and details to start posting or booking rides on TabFair."
        />
        <link
          rel="canonical"
          href="https://jade-rolypoly-5d4274.netlify.app/complete-profile"
        />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Complete your profile — TabFair" />
        <meta
          property="og:description"
          content="Set up your TabFair profile with a name, avatar, and travel info."
        />
        <meta
          property="og:image"
          content={
            preview || "https://jade-rolypoly-5d4274.netlify.app/og-image.jpg"
          }
        />
        <meta
          property="og:url"
          content="https://jade-rolypoly-5d4274.netlify.app/complete-profile"
        />
      </Helmet>

      <h2>Edit Your Profile</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Full Name:</label>
        <input
          id="name"
          type="text"
          name="name"
          value={profile.name}
          autoComplete="name"
          required
          onChange={handleInputChange}
        />

        <label htmlFor="nickname">Username:</label>
        <input
          id="nickname"
          type="text"
          name="nickname"
          value={profile.nickname}
          autoComplete="nickname"
          required
          onChange={handleInputChange}
        />

        <label htmlFor="avatar">Photo:</label>
        <div className="avatar-input-group">
          {preview ? (
            <img
              src={preview}
              alt="Profile avatar"
              className="avatar-preview"
            />
          ) : (
            <div className="avatar-placeholder">No image selected</div>
          )}
          <input
            id="avatar"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="file-upload"
          />
        </div>

        {showCropModal && cropFile && (
          <div className="crop-modal-overlay" role="dialog" aria-modal="true">
            <div className="crop-modal-content">
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowCropModal(false)}
                aria-label="Close crop modal"
              >
                &times;
              </button>
              <div className="crop-container">
                <CropModal
                  file={cropFile}
                  onCropComplete={handleCroppedUpload}
                  onCancel={() => setShowCropModal(false)}
                />
              </div>
              <div className="crop-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCropModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-save"
                  onClick={handleCroppedUpload}
                >
                  Save & Upload
                </button>
              </div>
            </div>
          </div>
        )}

        <label htmlFor="age">Age:</label>
        <input
          id="age"
          type="number"
          name="age"
          value={profile.age}
          min="18"
          required
          onChange={handleInputChange}
        />

        <label htmlFor="bio">About You:</label>
        <input
          id="bio"
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
