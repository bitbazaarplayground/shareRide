import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";

export default function ChatsList() {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, sender:sender_id(name), recipient:recipient_id(name)")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (!error) {
        const seenPartners = new Set();
        const grouped = [];

        for (const msg of data) {
          const partnerId =
            msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;

          if (!seenPartners.has(partnerId)) {
            grouped.push(msg);
            seenPartners.add(partnerId);
          }
        }

        setChats(grouped);
      } else {
        console.error("Error fetching chat users:", error);
      }
    };

    fetchChats();
  }, [user]);

  if (!user) return <p>Please log in to see your conversations.</p>;

  return (
    <div className="chats-list">
      <h2>Your Conversations</h2>
      <ul>
        {chats.map((msg) => {
          const partner =
            msg.sender_id === user.id ? msg.recipient : msg.sender;
          const partnerId =
            msg.sender_id === user.id ? msg.recipient_id : msg.sender_id;

          return (
            <li key={partnerId}>
              <Link to={`/chat/${partnerId}`}>
                <strong>{partner?.name || "Unnamed user"}</strong>
                <br />
                <small>{msg.content.slice(0, 40)}...</small>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
