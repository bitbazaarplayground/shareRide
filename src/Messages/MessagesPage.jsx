import React, { useEffect, useState } from "react";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";
import SendMessageForm from "./SendMessageForm";
import "./Styles/MessagesPage.css";

export default function MessagesPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data: chats, error } = await supabase
        .from("chats")
        .select(
          `
          id,
          user1,
          user2,
          ride_id,
          user1_profile:profiles!chats_user1_fkey(nickname, avatar_url),
          user2_profile:profiles!chats_user2_fkey(nickname, avatar_url),
          rides (from, to, date, time)
        `
        )
        .or(`user1.eq.${user.id},user2.eq.${user.id}`);

      if (error) {
        console.error("Error fetching chats:", error);
        return;
      }

      const result = await Promise.all(
        chats.map(async (chat) => {
          const isUser1 = chat.user1 === user.id;
          const partnerProfile = isUser1
            ? chat.user2_profile
            : chat.user1_profile;
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("content, created_at, sender_id, recipient_id, seen")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1);

          return {
            ...chat,
            partnerId: isUser1 ? chat.user2 : chat.user1,
            partnerNickname: partnerProfile?.nickname || "Unknown",
            partnerAvatar: partnerProfile?.avatar_url || null,
            content: lastMsg?.[0]?.content || "(No messages yet)",
            created_at: lastMsg?.[0]?.created_at || null,
            isUnread:
              lastMsg?.[0]?.recipient_id === user.id && !lastMsg?.[0]?.seen,
            ride: chat.rides || null,
          };
        })
      );

      setConversations(
        result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      );
    };

    fetchConversations();
  }, [user]);

  const loadMessages = async (chat) => {
    setSelectedChat(chat);
    setPartner({ id: chat.partnerId, nickname: chat.partnerNickname });
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chat.id)
      .order("created_at", { ascending: true });
    setMessages(data);
  };

  const handleNewMessage = (newMessage) => {
    setMessages((prev) => [...prev, newMessage]);
  };

  if (!user) return <p>Please log in to view your messages.</p>;

  return (
    <div className="messages-page">
      <aside className="sidebar">
        <h3>Contacts</h3>
        {conversations.map((convo) => (
          <div
            className="contact"
            key={convo.id}
            onClick={() => loadMessages(convo)}
          >
            <div className="avatar">
              {convo.partnerAvatar ? (
                <img src={convo.partnerAvatar} alt={convo.partnerNickname} />
              ) : (
                <span>{convo.partnerNickname.charAt(0)}</span>
              )}
            </div>
            <span>{convo.partnerNickname}</span>
          </div>
        ))}
      </aside>

      <main className="chat-preview">
        {selectedChat ? (
          <>
            <div className="conversation-card">
              <div className="top-line">
                <div className="top-left">
                  <div className="avatar">
                    {selectedChat.partnerAvatar ? (
                      <img
                        src={selectedChat.partnerAvatar}
                        alt={selectedChat.partnerNickname}
                      />
                    ) : (
                      <span>{selectedChat.partnerNickname.charAt(0)}</span>
                    )}
                  </div>
                  <div>
                    <strong>{selectedChat.partnerNickname}</strong>
                    <div className="destination">
                      {selectedChat.from} ➞ {selectedChat.to}
                    </div>
                  </div>
                </div>
              </div>
              {/* Ride details */}
              {selectedChat.ride && (
                <div className="ride-details">
                  <h3>Ride Details</h3>
                  <p>
                    <strong>From:</strong> {selectedChat.ride.from}
                  </p>
                  <p>
                    <strong>To:</strong> {selectedChat.ride.to}
                  </p>
                  <p>
                    <strong>Date & Time:</strong>{" "}
                    {new Date(selectedChat.ride.date).toLocaleDateString()} at{" "}
                    {new Date(
                      `1970-01-01T${selectedChat.ride.time}`
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}

              <div className="chat-thread">
                {messages.map((msg) => {
                  const isSender = msg.sender_id === user.id;
                  return (
                    <div
                      key={msg.id}
                      className={`chat-bubble ${isSender ? "sent" : "received"} ${
                        !msg.seen && !isSender ? "unread" : ""
                      }`}
                    >
                      <p>{msg.content}</p>

                      <small>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {isSender && (
                          <>
                            {" "}
                            ✓
                            <span
                              className={`status-icon ${msg.seen ? "read" : ""}`}
                            >
                              {msg.seen ? "✓" : ""}
                            </span>
                          </>
                        )}
                      </small>
                    </div>
                  );
                })}
              </div>

              <SendMessageForm
                chatId={selectedChat.id}
                recipientId={selectedChat.partnerId}
                onNewMessage={handleNewMessage}
              />
            </div>
          </>
        ) : (
          <h2>Your Conversations</h2>
        )}
      </main>
    </div>
  );
}
