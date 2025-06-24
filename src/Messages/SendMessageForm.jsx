import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";

export default function SendMessageForm({ recipientId, rideId }) {
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

  // 🔄 Sync typing status to Supabase
  useEffect(() => {
    if (!user || !recipientId) return;

    const updateTypingStatus = async () => {
      await supabase.from("typing_status").upsert(
        {
          sender_id: user.id,
          recipient_id: recipientId,
          is_typing: isTyping,
          updated_at: new Date().toISOString(),
        },
        { onConflict: ["sender_id", "recipient_id"] }
      );
    };

    updateTypingStatus();
  }, [isTyping, user, recipientId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: recipientId,
      content,
      seen: false,
      ride_id: rideId,
    });

    if (!error) setContent("");
    else console.error("Message send error:", error);
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
