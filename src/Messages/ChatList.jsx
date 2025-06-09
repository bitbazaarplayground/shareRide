import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { db } from "../firebase";

export default function ChatsList() {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid),
      orderBy("created_at", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const seenPartners = new Set();
      const uniqueChats = [];

      for (const docSnap of snapshot.docs) {
        const msg = docSnap.data();
        const partnerId =
          msg.sender_id === user.uid ? msg.recipient_id : msg.sender_id;

        if (!seenPartners.has(partnerId)) {
          seenPartners.add(partnerId);

          // Fetch user display name (or fallback)
          const userDoc = await getDoc(doc(db, "profiles", partnerId));
          const profileData = userDoc.exists() ? userDoc.data() : {};

          uniqueChats.push({
            ...msg,
            partnerId,
            partnerName: profileData.name || "Unnamed user",
          });
        }
      }

      setChats(uniqueChats);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) return <p>Please log in to see your conversations.</p>;

  return (
    <div className="chats-list">
      <h2>Your Conversations</h2>
      <ul>
        {chats.map((chat) => (
          <li key={chat.partnerId}>
            <Link to={`/chat/${chat.partnerId}`}>
              <strong>{chat.partnerName}</strong>
              <br />
              <small>{chat.content.slice(0, 40)}...</small>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
