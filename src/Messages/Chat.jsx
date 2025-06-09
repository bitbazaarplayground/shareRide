import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { db } from "../firebase";

export default function Chat() {
  const { user } = useAuth();
  const { userId } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (!user || !userId) return;

    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid),
      orderBy("created_at", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (msg) =>
            (msg.sender_id === user.uid && msg.recipient_id === userId) ||
            (msg.sender_id === userId && msg.recipient_id === user.uid)
        );

      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [user, userId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    await addDoc(collection(db, "messages"), {
      sender_id: user.uid,
      recipient_id: userId,
      participants: [user.uid, userId],
      content: newMessage,
      seen: false,
      created_at: serverTimestamp(),
    });

    setNewMessage("");
  };

  return (
    <div className="chat-container">
      <h2>Chat with User {userId}</h2>
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={
              msg.sender_id === user.uid ? "message me" : "message them"
            }
          >
            {msg.content}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
