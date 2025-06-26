import React, { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import SendMessageForm from "./SendMessageForm";
import "./Styles/ChatRoom.css";

export default function ChatRoom() {
  const { user } = useAuth();
  const { partnerId } = useParams();
  const { state } = useLocation(); // ← ride + nickname may arrive here
  const [messages, setMessages] = useState([]);
  const [ride, setRide] = useState(state?.ride || null); // instant if provided
  const chatEndRef = useRef(null);

  /* ------------------ 1. FETCH MESSAGES ------------------ */
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

      if (!error) {
        setMessages(data);

        // mark unseen as seen
        const unseen = data.filter(
          (m) => m.recipient_id === user.id && !m.seen
        );
        if (unseen.length) {
          await supabase
            .from("messages")
            .update({ seen: true })
            .in(
              "id",
              unseen.map((m) => m.id)
            );
        }
      } else {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();

    // realtime
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        ({ new: msg }) => {
          if (
            (msg.sender_id === user.id && msg.recipient_id === partnerId) ||
            (msg.sender_id === partnerId && msg.recipient_id === user.id)
          ) {
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
            );
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, partnerId]);

  /* ------------------ 2. FETCH RIDE (only if not passed) ------------------ */
  useEffect(() => {
    if (ride || !user || !partnerId) return; // already have it

    const fetchRide = async () => {
      const { data, error } = await supabase
        .from("rides")
        .select("*")
        .in("user_id", [user.id, partnerId])
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && data.length) setRide(data[0]);
      else if (error) console.error("Error fetching ride:", error);
    };

    fetchRide();
  }, [ride, user, partnerId]);

  /* ------------------ 3. SCROLL TO BOTTOM ------------------ */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) return <p>Please log in</p>;

  let lastDate = "";

  return (
    <div className="chat-room">
      <h2>Chat with {state?.partnerNickname || partnerId}</h2>

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
            <strong>Date:</strong> {new Date(ride.date).toLocaleString()}
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
