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
      const { data: chats, error: chatsError } = await supabase
        .from("chats")
        .select(
          `
          id,
          user1,
          user2,
          ride_id,
          user1_profile:profiles!chats_user1_fkey(nickname),
          user2_profile:profiles!chats_user2_fkey(nickname),
          rides (
            from,
            to,
            date,
            time
          )
        `
        )
        .or(`user1.eq.${user.id},user2.eq.${user.id}`);

      if (chatsError) {
        console.error("Error fetching chats:", chatsError);
        return;
      }

      const conversationsWithMessages = await Promise.all(
        chats.map(async (chat) => {
          const partnerId = chat.user1 === user.id ? chat.user2 : chat.user1;
          const partnerNickname =
            chat.user1 === user.id
              ? chat.user2_profile?.nickname
              : chat.user1_profile?.nickname;

          const { data: latestMessageData } = await supabase
            .from("messages")
            .select("content, created_at, sender_id, recipient_id")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1);

          const latestMessage = latestMessageData?.[0];

          return {
            id: chat.id,
            partnerId,
            partnerNickname,
            content: latestMessage?.content || "(No messages yet)",
            created_at: latestMessage?.created_at || null,
            fromLocation: chat.rides?.from,
            toLocation: chat.rides?.to,
            rideDate: chat.rides?.date,
            rideTime: chat.rides?.time,
          };
        })
      );

      conversationsWithMessages.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });

      setConversations(conversationsWithMessages);
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
              to={`/chat/${convo.id}`}
              className="conversation-link"
            >
              <div className="conversation-card">
                <div className="top-line">
                  <div className="name-destination">
                    <strong>{convo.partnerNickname || convo.partnerId}</strong>
                    <span className="destination">
                      {convo.fromLocation} → {convo.toLocation}
                    </span>
                  </div>
                  <small className="timestamp">
                    {convo.created_at
                      ? new Date(convo.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </small>
                </div>

                <p className="preview">
                  {convo.content.length > 60
                    ? convo.content.slice(0, 60) + "..."
                    : convo.content}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
