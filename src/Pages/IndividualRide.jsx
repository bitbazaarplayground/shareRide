import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { db } from "../firebase"; // Assuming db = getFirestore(app)

export default function IndividualRide() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRideWithUser() {
      try {
        const rideRef = doc(db, "rides", id);
        const rideSnap = await getDoc(rideRef);

        if (!rideSnap.exists()) {
          setRide(null);
        } else {
          const rideData = rideSnap.data();

          // Fetch poster info
          const profileRef = doc(db, "profiles", rideData.user_id); // assuming rideData has a user_id field
          const profileSnap = await getDoc(profileRef);
          rideData.profiles = profileSnap.exists() ? profileSnap.data() : null;

          setRide({ id: rideSnap.id, ...rideData });
        }
      } catch (error) {
        console.error("Error fetching ride:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRideWithUser();
  }, [id]);

  const handleMessageClick = async () => {
    if (!user || !ride?.profiles?.id) return;

    const userA = user.uid;
    const userB = ride.profiles.id;
    const [participant1, participant2] =
      userA < userB ? [userA, userB] : [userB, userA];

    try {
      const chatQuery = query(
        collection(db, "chats"),
        where("user1", "==", participant1),
        where("user2", "==", participant2)
      );
      const chatSnapshot = await getDocs(chatQuery);

      let chatId;
      if (!chatSnapshot.empty) {
        chatId = chatSnapshot.docs[0].id;
      } else {
        const newChatRef = await addDoc(collection(db, "chats"), {
          user1: participant1,
          user2: participant2,
        });
        chatId = newChatRef.id;
      }

      navigate(`/chat/${chatId}`);
    } catch (error) {
      console.error("Error handling chat creation:", error);
    }
  };

  if (loading) return <p>Loading ride details...</p>;
  if (!ride) return <p>Ride not found.</p>;

  return (
    <div className="ride-details">
      <h2>Ride Details</h2>
      <p>
        <strong>From:</strong> {ride.from}
      </p>
      <p>
        <strong>To:</strong> {ride.to}
      </p>
      <p>
        <strong>Date:</strong> {ride.date}
      </p>
      <p>
        <strong>Seats Available:</strong> {ride.seats}
      </p>
      <p>
        <strong>Notes:</strong> {ride.notes || "No notes"}
      </p>

      <hr />

      <h3>Posted By</h3>
      {ride.profiles ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={ride.profiles.avatar_url || "/default-avatar.png"}
            alt={`${ride.profiles.nickname}'s avatar`}
            style={{ width: "40px", height: "40px", borderRadius: "50%" }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <Link to={`/profile/${ride.profiles.id}`}>
              <strong>{ride.profiles.nickname}</strong>
            </Link>

            {user?.uid !== ride.profiles.id && (
              <button className="btn white" onClick={handleMessageClick}>
                Message
              </button>
            )}
          </div>
        </div>
      ) : (
        <p>User info not available.</p>
      )}
    </div>
  );
}
