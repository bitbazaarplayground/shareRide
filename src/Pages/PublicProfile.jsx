import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import SendMessageForm from "../Messages/SendMessageForm";
import { db } from "../firebase";

export default function PublicProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const docRef = doc(db, "profiles", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfileData(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching profile:", error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [id]);

  const handleRequestRide = () => {
    alert("Ride request feature coming soon.");
  };

  if (loading) return <p>Loading profile...</p>;
  if (!profileData) return <p>Profile not found.</p>;

  return (
    <div className="profile-container">
      <h2>{profileData.name}'s Profile</h2>
      <img src={profileData.avatar_url || "/default-avatar.png"} alt="Avatar" />

      <p>
        <strong>Email:</strong> {profileData.email}
      </p>
      <p>
        <strong>Age:</strong> {profileData.age || "N/A"}
      </p>
      <p>
        <strong>Role:</strong> {profileData.role}
      </p>
      <p>
        <strong>Bio:</strong> {profileData.bio || "No bio provided."}
      </p>
      <p>
        <strong>Interests:</strong>
      </p>
      {Array.isArray(profileData.interests) && profileData.interests.length ? (
        <ul>
          {profileData.interests.map((int, i) => (
            <li key={i}>{int}</li>
          ))}
        </ul>
      ) : (
        <p>No interests listed.</p>
      )}

      <div style={{ marginTop: "20px" }}>
        <button className="btn white" onClick={handleRequestRide}>
          Request a Ride
        </button>
      </div>

      {user && user.uid !== id && (
        <div>
          <h3>Send Message</h3>
          <SendMessageForm recipientId={id} />
        </div>
      )}
    </div>
  );
}
