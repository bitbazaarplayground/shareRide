import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import "./Styles/MessagesPage.css";

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, sender:sender_id(name), recipient:recipient_id(name)")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false }); // Latest messages first

      if (error) {
        console.error("Error fetching messages:", error);
        return;
      }

      // Group by unique conversation partner
      const convoMap = {};
      data.forEach((msg) => {
        const isSender = msg.sender_id === user.id;
        const partnerId = isSender ? msg.recipient_id : msg.sender_id;

        if (!convoMap[partnerId]) {
          convoMap[partnerId] = {
            ...msg,
            partner: isSender ? msg.recipient : msg.sender,
            partnerId,
          };
        }
      });

      setConversations(Object.values(convoMap));
    };

    fetchConversations();
  }, [user]);

  if (!user) return <p>Please log in to view your messages.</p>;

  return (
    <div className="messages-page">
      <h2>Your Conversations</h2>

      {conversations.length === 0 ? (
        <p>No messages yet.</p>
      ) : (
        <div className="conversation-list">
          {conversations.map((convo) => (
            <Link
              key={convo.id}
              to={`/chat/${convo.partnerId}`}
              className="conversation-link"
            >
              <div className="conversation-card">
                <strong>{convo.partner?.name || convo.partnerId}</strong>
                <p className="preview">{convo.content}</p>
                <small className="timestamp">
                  {new Date(convo.created_at).toLocaleTimeString()}
                </small>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
