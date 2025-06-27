// ChatRoom.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import SendMessageForm from "./SendMessageForm";
import "./Styles/ChatRoom.css";

export default function ChatRoom() {
  const { user } = useAuth();
  const { chatId } = useParams();
  const chatIdInt = parseInt(chatId);
  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);
  const [ride, setRide] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!chatIdInt || !user) return;

    const fetchChatDetails = async () => {
      const { data: chat, error: chatError } = await supabase
        .from("chats")
        .select("*")
        .eq("id", chatIdInt)
        .single();

      if (chatError || !chat) {
        console.error("Error fetching chat:", chatError);
        return;
      }

      const partnerId = chat.user1 === user.id ? chat.user2 : chat.user1;

      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("id, nickname")
        .eq("id", partnerId)
        .single();

      setPartner(partnerProfile || { id: partnerId, nickname: "Deleted User" });

      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatIdInt)
        .order("created_at", { ascending: true });

      setMessages(msgs);

      const unseen = msgs.filter((m) => m.recipient_id === user.id && !m.seen);
      if (unseen.length > 0) {
        await supabase
          .from("messages")
          .update({ seen: true })
          .in(
            "id",
            unseen.map((m) => m.id)
          );
      }

      // ✅ CORRECT: only fetch the ride if it exists on the chat
      if (chat.ride_id) {
        const { data: rideDetails, error: rideError } = await supabase
          .from("rides")
          .select("*")
          .eq("id", chat.ride_id)
          .single();

        if (rideError) {
          console.error("Error fetching ride:", rideError);
        } else {
          setRide(rideDetails);
        }
      }
    };

    // ✅ Correct: invoke function *outside* its own body
    fetchChatDetails();

    const channel = supabase
      .channel("chat-room-listeners")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        ({ new: msg }) => {
          if (msg.chat_id === chatIdInt && msg.sender_id !== user.id) {
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "typing_status",
          filter: `sender_id=eq.${partner?.id}`,
        },
        (payload) => {
          if (
            payload.new.sender_id === partner?.id &&
            payload.new.recipient_id === user.id
          ) {
            setIsTyping(payload.new.is_typing);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatIdInt, user, partner?.id]);

  const handleNewMessage = (newMessage) => {
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };

  if (!user) return <p>Please log in</p>;

  return (
    <div className="chat-room">
      <h2>Chat with {partner?.nickname || "..."}</h2>

      {ride && (
        <div className="ride-details">
          <h3>Ride Details</h3>
          <p>
            <strong>From:</strong> {ride.from}
          </p>
          <p>
            <strong>To:</strong> {ride.to}
          </p>
          <p>
            <strong>Date & Time:</strong>{" "}
            {ride.date && ride.time
              ? `${new Date(ride.date).toLocaleDateString()} at ${new Date(
                  `${ride.date}T${ride.time}`
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`
              : "Not specified"}
          </p>
          <p>
            <strong>Seats:</strong> {ride.seats}
          </p>
          {ride.note && (
            <p>
              <strong>Note:</strong> {ride.note}
            </p>
          )}
          <p>
            <strong>Status:</strong> {ride.status}
          </p>
        </div>
      )}

      <div className="chat-thread">
        {messages.map((msg) => {
          const isSender = msg.sender_id === user.id;
          return (
            <div
              key={msg.id}
              className={`chat-bubble ${isSender ? "sent" : "received"}`}
            >
              <div className="bubble-meta">
                <strong>
                  {isSender ? "You" : partner?.nickname || "Partner"}
                </strong>
                <small>{new Date(msg.created_at).toLocaleTimeString()}</small>
              </div>
              <p>{msg.content}</p>
              {isSender && (
                <small className="seen-indicator">
                  {msg.seen ? "✓ Seen" : "✓ Sent"}
                </small>
              )}
            </div>
          );
        })}

        {isTyping && (
          <p className="typing-indicator">{partner?.nickname} is typing...</p>
        )}

        <div ref={chatEndRef} />
      </div>

      <SendMessageForm
        chatId={chatIdInt}
        recipientId={partner?.id}
        onNewMessage={handleNewMessage}
      />
    </div>
  );
}
