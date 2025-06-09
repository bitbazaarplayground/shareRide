import {
  addDoc,
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../Contexts/AuthContext";

const db = getFirestore();

export default function SendMessageForm({ recipientId }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const handleChange = (e) => {
    setContent(e.target.value);
    setIsTyping(true);

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  // Update typing status in Firestore
  useEffect(() => {
    if (!user || !recipientId) return;

    const typingDocRef = doc(db, "typing_status", `${user.uid}_${recipientId}`);

    const updateTypingStatus = async () => {
      try {
        await setDoc(
          typingDocRef,
          {
            sender_id: user.uid,
            recipient_id: recipientId,
            is_typing: isTyping,
            updated_at: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Typing status update error:", error);
      }
    };

    updateTypingStatus();
  }, [isTyping, user, recipientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await addDoc(collection(db, "messages"), {
        sender_id: user.uid,
        recipient_id: recipientId,
        content,
        seen: false,
        created_at: serverTimestamp(),
      });
      setContent("");
    } catch (error) {
      console.error("Message send error:", error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="send-message-form">
      <textarea
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        rows={1}
        className="chat-textarea"
      />
      <button type="submit">Send</button>
      {isTyping && <p className="typing-indicator">Typing...</p>}
    </form>
  );
}
