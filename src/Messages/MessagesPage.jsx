import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import SendMessageForm from "./SendMessageForm";
import "./Styles/MessagesPage.css";

export default function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null); // ✅ For auto-scroll

  useEffect(() => {
    if (!user) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, sender:sender_id(name), recipient:recipient_id(name)")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: true }); // ✅ Ascending for chat style

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages(data);

        // ✅ Mark unread messages as seen
        const unseenMessages = data.filter(
          (msg) => msg.recipient_id === user.id && !msg.seen
        );

        if (unseenMessages.length > 0) {
          const unseenIds = unseenMessages.map((msg) => msg.id);
          await supabase
            .from("messages")
            .update({ seen: true })
            .in("id", unseenIds);
        }
      }
    };

    fetchMessages();

    const messageChannel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    const typingChannel = supabase
      .channel("typing_status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "typing_status",
        },
        (payload) => {
          const { sender_id, recipient_id, is_typing } = payload.new;
          if (recipient_id === user.id) {
            setIsTyping(is_typing);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) return <p>Please log in to view your messages.</p>;

  return (
    <div className="messages-page">
      <h2>Your Messages</h2>

      <div className="message-thread">
        {messages.map((msg) => {
          const isSender = msg.sender_id === user.id;
          const partner = isSender ? msg.recipient : msg.sender;
          const partnerId = isSender ? msg.recipient_id : msg.sender_id;

          const currentDate = new Date(msg.created_at).toDateString();
          const showDate = currentDate !== lastDate;
          lastDate = currentDate;

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="date-divider">
                  <hr />
                  <span>{currentDate}</span>
                  <hr />
                </div>
              )}

              <div
                className={`message-bubble ${isSender ? "sent" : "received"}`}
              >
                <div className="bubble-header">
                  <Link to={`/public-profile/${partnerId}`}>
                    {partner?.name || partnerId}
                  </Link>{" "}
                  <small>
                    ({new Date(msg.created_at).toLocaleTimeString()})
                  </small>
                </div>
                <div className="bubble-body">
                  <p>{msg.content}</p>
                  {!isSender && (
                    <button
                      className="reply-btn"
                      onClick={() => setReplyTo(partnerId)}
                    >
                      Reply
                    </button>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {isTyping && (
          <p className="typing-indicator">User is typing...</p> // ✅
        )}
        <div ref={messagesEndRef} />
      </div>

      <hr />
      <h3>Send a Message</h3>
      <SendMessageForm
        recipientId={replyTo || "recipient-user-id-placeholder"}
      />
    </div>
  );
}
