import Picker from "emoji-picker-react";
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./Styles/SendMessageForm.css";

export default function SendMessageForm({ chatId, recipientId, onNewMessage }) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [recipientTyping, setRecipientTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const typingTimeoutRef = useRef(null);

  const handleChange = (e) => {
    setContent(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      upsertTypingStatus(true);
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      upsertTypingStatus(false);
    }, 1500);
  };

  const upsertTypingStatus = async (typing) => {
    if (!user || !recipientId) return;

    await supabase.from("typing_status").upsert(
      {
        sender_id: user.id,
        recipient_id: recipientId,
        is_typing: typing,
        updated_at: new Date().toISOString(),
      },
      { onConflict: ["sender_id", "recipient_id"] }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    setSending(true);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        recipient_id: recipientId,
        content: trimmed,
        seen: false,
      })
      .select();

    setSending(false);

    if (error) {
      console.error("Message send error:", error);
    } else {
      setContent("");
      setShowEmojiPicker(false);
      setIsTyping(false);
      await upsertTypingStatus(false);

      if (onNewMessage && data?.[0]) {
        onNewMessage(data[0]);
      }
    }
  };

  useEffect(() => {
    if (!user || !recipientId) return;

    const channel = supabase
      .channel("typing-channel")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "typing_status" },
        (payload) => {
          const data = payload.new;
          if (data.sender_id === recipientId && data.recipient_id === user.id) {
            setRecipientTyping(data.is_typing);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, recipientId]);

  const handleEmojiClick = (emojiData) => {
    setContent((prev) => prev + emojiData.emoji);
  };

  return (
    <>
      {recipientTyping && (
        <p className="typing-feedback">Your chat partner is typing...</p>
      )}
      <form onSubmit={handleSubmit} className="send-message-form">
        <div className="textarea-wrapper">
          <textarea
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            rows={1}
            className="chat-textarea"
            disabled={sending}
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="emoji-btn"
            title="Add emoji"
          >
            😊
          </button>
        </div>

        {showEmojiPicker && (
          <div className="emoji-picker">
            <Picker onEmojiClick={handleEmojiClick} />
          </div>
        )}

        <button type="submit" disabled={sending || !content.trim()}>
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </>
  );
}
