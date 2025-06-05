import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import SendMessageForm from "../Messages/SendMessageForm";
import { supabase } from "../supabaseClient";
import "./StylesPages/UserProfile.css"; // Reuse same styling

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth(); // get logged-in user
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, bio, avatar_url, interests, id")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching public profile:", error.message);
      } else {
        setProfileData(data);
      }

      setLoading(false);
    }

    fetchProfile();
  }, [id]);

  const handleRequestRide = () => {
    alert(`You can now send a ride request to ${profileData.name}`);
    // TODO: later, open a modal or ride request form
  };

  if (loading) return <p>Loading profile...</p>;
  if (!profileData) return <p>Profile not found.</p>;

  return (
    <div className="profile-container">
      <h2>{profileData.name}'s Profile</h2>
      <div className="profile-section">
        <div className="profile-pic">
          <img
            src={profileData.avatar_url || "/default-avatar.png"}
            alt={`${profileData.name}'s avatar`}
            className="avatar"
          />
        </div>

        <div className="profile-info">
          <label>Bio:</label>
          <p>{profileData.bio || "No bio available."}</p>

          <label>Interests:</label>
          {profileData.interests && profileData.interests.length > 0 ? (
            <div className="interest-list">
              {profileData.interests.map((item, index) => (
                <div key={index} className="interest-chip">
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <p>No interests listed.</p>
          )}

          <div style={{ marginTop: "20px" }}>
            <button className="btn white" onClick={handleRequestRide}>
              Request a Ride
            </button>
          </div>

          {user && user.id !== id && (
            <div style={{ marginTop: "30px" }}>
              <h3>Send Message to {profileData.name}</h3>
              <SendMessageForm recipientId={id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
