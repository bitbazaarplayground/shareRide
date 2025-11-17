// src/Messages/SendMessageForm.jsx
import Picker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./Styles/SendMessageForm.css";

/**
 * Props:
 *  - chatId: number|string
 *  - recipientId: string (UUID)
 *  - onNewMessage?: (msg) => void  // optional; realtime also updates
 *  - partnerName?: string          // for "Alex is typing…"
 */
export default function SendMessageForm({
  chatId,
  recipientId,
  onNewMessage,
  partnerName,
}) {
  const { user } = useAuth();

  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [recipientTyping, setRecipientTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Avoid redundant writes
  const lastTypingSentRef = useRef(null);

  const setRemoteTyping = async (typing) => {
    if (!user || !recipientId) return;
    if (lastTypingSentRef.current === typing) return;
    lastTypingSentRef.current = typing;

    const { error } = await supabase.from("typing_status").upsert(
      {
        sender_id: user.id,
        recipient_id: recipientId,
        is_typing: typing,
        updated_at: new Date().toISOString(), // force UPDATE for realtime
      },
      { onConflict: ["sender_id", "recipient_id"] }
    );
    if (error) console.warn("typing upsert error:", error);
  };

  // Initialize indicator (before realtime fires)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !recipientId) return;
      const { data, error } = await supabase
        .from("typing_status")
        .select("is_typing")
        .eq("sender_id", recipientId)
        .eq("recipient_id", user.id)
        .maybeSingle();
      if (!cancelled && !error) {
        setRecipientTyping(!!data?.is_typing);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, recipientId]);

  // Realtime subscription to the partner's typing row
  useEffect(() => {
    if (!user || !recipientId) return;
    const chanName = `typing:${chatId || "global"}`;

    const channel = supabase
      .channel(chanName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "typing_status" },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (row.sender_id === recipientId && row.recipient_id === user.id) {
            setRecipientTyping(!!row.is_typing);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, recipientId, chatId]);

  // Typing logic:
  // - Show typing ONLY after user actually types (content becomes non-empty)
  // - Keep it ON as long as there's any draft text
  // - Turn OFF when input becomes empty or after sending
  useEffect(() => {
    const hasDraft = content.trim().length > 0;
    setRemoteTyping(hasDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // On unmount: best-effort turn typing OFF if empty (if draft remains, we keep)
  useEffect(() => {
    return () => {
      if (content.trim().length === 0) setRemoteTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setContent(e.target.value);
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
    const cid = Number(chatId);
    if (!trimmed || !user || !recipientId || !Number.isFinite(cid)) return;

    setSending(true);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        chat_id: cid,
        sender_id: user.id,
        recipient_id: recipientId,
        content: trimmed,
        seen: false,
      })
      .select();

    setSending(false);

    if (error) {
      console.error("Message send error:", error);
      return;
    }

    setContent(""); // clear draft
    await setRemoteTyping(false); // stop typing

    if (onNewMessage && data?.[0]) onNewMessage(data[0]); // optimistic for sender
  };

  const handleEmojiClick = (emojiData) => {
    setContent((prev) => prev + (emojiData?.emoji || ""));
  };

  const partnerLabel = partnerName?.trim() || "Your chat partner";

  return (
    <>
      {recipientTyping && (
        <p className="typing-feedback">{partnerLabel} is typing…</p>
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
