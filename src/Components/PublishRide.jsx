import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AutocompleteInput from "../Components/AutocompleteInput";
import "../Components/Styles/PublishRide.css";
import { useAuth } from "../Contexts/AuthContext";
import { app } from "../firebase";

const db = getFirestore(app);
const auth = getAuth(app);

export default function PublishRide() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = new Date().toISOString().split("T")[0];
  const [fromPlace, setFromPlace] = useState("");
  const [toPlace, setToPlace] = useState("");
  const [date, setDate] = useState(today);
  const [seats, setSeats] = useState(1);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkProfile = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("You must be logged in to publish a ride.");
        navigate("/login");
        return;
      }

      const profileRef = doc(db, "profiles", currentUser.uid);
      const profileSnap = await getDoc(profileRef);

      if (!profileSnap.exists() || !profileSnap.data().nickname) {
        alert("Please complete your profile before publishing a ride.");
        navigate("/complete-profile");
      }
    };

    checkProfile();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!fromPlace || !toPlace) {
      setMessage("Please select both From and To addresses.");
      return;
    }

    if (!user) {
      setMessage("You must be logged in to publish a ride.");
      return;
    }

    setLoading(true);

    try {
      const ride = {
        from: fromPlace,
        to: toPlace,
        date,
        seats,
        notes,
        user_id: user.uid,
        status: "active",
      };

      const docRef = await addDoc(collection(db, "rides"), ride);

      setMessage("✅ Ride published successfully!");
      setTimeout(() => {
        navigate("/all-rides", {
          state: { rides: [ride], message: "✅ Ride published successfully!" },
        });
      }, 1500);
    } catch (error) {
      console.error("Error publishing ride:", error.message);
      setMessage("Error publishing ride.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="publish-container">
      <h2>Publish Your Ride</h2>
      <form onSubmit={handleSubmit}>
        <AutocompleteInput
          placeholder="From"
          onPlaceSelected={(place) => setFromPlace(place.formatted_address)}
        />
        <AutocompleteInput
          placeholder="To"
          onPlaceSelected={(place) => setToPlace(place.formatted_address)}
        />
        <input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Seats"
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          min={1}
          required
        />
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Publishing..." : "Publish"}
        </button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
}
