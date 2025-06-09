import { doc, getDoc, getFirestore, updateDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { app } from "../firebase";
import "./StylesPages/UserProfile.css";

const db = getFirestore(app);

export default function UserProfile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [newInterest, setNewInterest] = useState("");
  const [preview, setPreview] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const getProfile = async () => {
      const profileRef = doc(db, "profiles", user.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        const data = profileSnap.data();

        if (
          !data.name ||
          !data.age ||
          !data.interests ||
          data.interests.length === 0 ||
          data.role
        ) {
          navigate("/complete-profile");
        } else {
          setProfileData(data);
        }
      } else {
        navigate("/complete-profile");
      }
    };

    if (user) getProfile();
  }, [user, navigate]);

  if (!user) return <p>Please log in to view your profile.</p>;
  if (!profileData) return <p>Loading profile...</p>;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData({ ...profileData, [name]: value });
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAddInterest = () => {
    if (newInterest.trim()) {
      setProfileData({
        ...profileData,
        interests: [...(profileData.interests || []), newInterest.trim()],
      });
      setNewInterest("");
    }
  };

  const handleRemoveInterest = (indexToRemove) => {
    setProfileData({
      ...profileData,
      interests: profileData.interests.filter(
        (_, index) => index !== indexToRemove
      ),
    });
  };

  const handleSave = async () => {
    try {
      const profileRef = doc(db, "profiles", user.uid);
      await updateDoc(profileRef, profileData);
      alert("Profile updated!");
    } catch (error) {
      console.error("Failed to save changes:", error.message);
    }
  };

  return (
    <div className="profile-container">
      <h2>Your Profile</h2>
      <div className="profile-section">
        <div className="profile-pic">
          <img
            src={preview || profileData.avatar_url || "/default-avatar.png"}
            alt="Profile"
            className="avatar"
          />
          <input type="file" onChange={handlePhotoChange} />
        </div>

        <div className="profile-info">
          <label>Name:</label>
          <input
            type="text"
            name="name"
            value={profileData.name || ""}
            onChange={handleInputChange}
          />

          <label>Email:</label>
          <input type="email" value={user.email} disabled />

          <label>Bio:</label>
          <textarea
            name="bio"
            value={profileData.bio || ""}
            onChange={handleInputChange}
          />

          <label>Interests:</label>
          <div className="interest-list">
            {(profileData.interests || []).map((item, index) => (
              <div key={index} className="interest-chip">
                {item}
                <button onClick={() => handleRemoveInterest(index)}>×</button>
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Add interest"
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
          />
          <button onClick={handleAddInterest}>Add</button>
        </div>
      </div>
      <button className="save-btn" onClick={handleSave}>
        Save Changes
      </button>
    </div>
  );
}
