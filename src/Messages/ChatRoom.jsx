import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import SendMessageForm from "./SendMessageForm";
import "./Styles/ChatRoom.css";

export default function ChatRoom() {
  const { user } = useAuth();
  const { partnerId } = useParams();
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!user || !partnerId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, sender:sender_id(name), recipient:recipient_id(name)")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages(data);

        // Mark unseen messages as seen
        const unseen = data.filter(
          (msg) => msg.recipient_id === user.id && !msg.seen
        );
        if (unseen.length > 0) {
          const ids = unseen.map((msg) => msg.id);
          await supabase.from("messages").update({ seen: true }).in("id", ids);
        }
      }
    };

    fetchMessages();

    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new;
          if (
            (msg.sender_id === user.id && msg.recipient_id === partnerId) ||
            (msg.sender_id === partnerId && msg.recipient_id === user.id)
          ) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, partnerId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) return <p>Please log in</p>;

  let lastDate = "";

  return (
    <div className="chat-room">
      <h2>Chat with {partnerId}</h2>

      <div className="chat-thread">
        {messages.map((msg) => {
          const isSender = msg.sender_id === user.id;
          const currentDate = new Date(msg.created_at).toDateString();
          const showDate = currentDate !== lastDate;
          if (showDate) lastDate = currentDate;

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="date-divider">
                  <hr />
                  <span>{currentDate}</span>
                  <hr />
                </div>
              )}
              <div className={`chat-bubble ${isSender ? "sent" : "received"}`}>
                <div className="bubble-meta">
                  <strong>
                    {isSender ? "You" : msg.sender?.name || msg.sender_id}
                  </strong>
                  <small>{new Date(msg.created_at).toLocaleTimeString()}</small>
                </div>
                <p>{msg.content}</p>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      <SendMessageForm recipientId={partnerId} />
    </div>
  );
}
