import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";

export default function Chat() {
  const { user } = useAuth();
  const { userId } = useParams(); // chat with this user
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    // Fetch chat messages between current user and the recipient
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: true });

      if (!error) {
        const relevant = data.filter(
          (msg) =>
            (msg.sender_id === user.id && msg.recipient_id === userId) ||
            (msg.sender_id === userId && msg.recipient_id === user.id)
        );
        setMessages(relevant);

        // Mark messages as seen
        await supabase
          .from("messages")
          .update({ seen: true })
          .eq("recipient_id", user.id)
          .eq("sender_id", userId)
          .eq("seen", false);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel("chat-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = payload.new;
          if (
            (msg.sender_id === userId && msg.recipient_id === user.id) ||
            (msg.sender_id === user.id && msg.recipient_id === userId)
          ) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, userId]);

  const handleSend = async () => {
    if (newMessage.trim() === "") return;

    const { error } = await supabase.from("messages").insert([
      {
        sender_id: user.id,
        recipient_id: userId,
        content: newMessage,
        seen: false,
      },
    ]);

    if (!error) {
      setNewMessage("");
    }
  };

  return (
    <div className="chat-container">
      <h2>Chat with User {userId}</h2>
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={
              msg.sender_id === user.id ? "message me" : "message them"
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
