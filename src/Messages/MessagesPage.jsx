// src/Messages/MessagesPage.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import useChatMessages from "../hooks/useChatMessages";
import { supabase } from "../supabaseClient";
import SendMessageForm from "./SendMessageForm";
import "./Styles/MessagesPage.css";

export default function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams();

  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [partner, setPartner] = useState(null);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const chatEndRef = useRef(null);

  // 🔄 realtime messages for the active chat
  const { messages } = useChatMessages(chatId);

  // Conversations list (left column)
  useEffect(() => {
    if (!user) return;

    (async () => {
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
          rides (from, to, date, time, seats, notes, status)
        `
        )
        .or(`user1.eq.${user.id},user2.eq.${user.id}`);

      if (error) {
        console.error("Error fetching chats:", error);
        return;
      }

      const result = await Promise.all(
        (chats || []).map(async (chat) => {
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
    })();
  }, [user]);

  // Load selected chat header (partner + ride details)
  useEffect(() => {
    if (!user || !chatId) return;

    (async () => {
      const chatIdInt = parseInt(chatId, 10);
      const { data: chat, error } = await supabase
        .from("chats")
        .select(
          `
          id,
          user1,
          user2,
          ride_id,
          user1_profile:profiles!chats_user1_fkey(nickname, avatar_url),
          user2_profile:profiles!chats_user2_fkey(nickname, avatar_url),
          rides (from, to, date, time, seats, notes, status)
        `
        )
        .eq("id", chatIdInt)
        .single();

      if (error || !chat) {
        console.error("Chat not found:", error);
        return;
      }

      const isUser1 = chat.user1 === user.id;
      const partnerProfile = isUser1 ? chat.user2_profile : chat.user1_profile;

      const chatData = {
        ...chat,
        partnerId: isUser1 ? chat.user2 : chat.user1,
        partnerNickname: partnerProfile?.nickname || "Unknown",
        partnerAvatar: partnerProfile?.avatar_url || null,
        ride: chat.rides || null,
      };

      setSelectedChat(chatData);
      setPartner({
        id: chatData.partnerId,
        nickname: chatData.partnerNickname,
      });

      // reset per-chat typing banner on switch
      setIsPartnerTyping(false);
    })();
  }, [chatId, user]);

  // 🔔 subscribe to typing_status for partner -> you
  useEffect(() => {
    if (!user?.id || !selectedChat?.partnerId) return;

    const channel = supabase
      .channel(`typing:${selectedChat.partnerId}->${user.id}`)
      // listen for either INSERTs or UPDATEs where YOU are the recipient
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "typing_status",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const rec = payload.new || payload.old || {};
          // we only care about the current partner
          if (rec.sender_id === selectedChat.partnerId) {
            // new row OR updated row: show/hide typing
            const isTyping = payload.new ? !!payload.new.is_typing : false;
            setIsPartnerTyping(isTyping);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      setIsPartnerTyping(false);
    };
  }, [user?.id, selectedChat?.partnerId]);

  // Auto-scroll on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark newly received messages as seen (when they arrive)
  useEffect(() => {
    if (!user || !messages?.length || !selectedChat?.id) return;

    const unseen = messages.filter(
      (m) => m.recipient_id === user.id && !m.seen
    );
    if (unseen.length === 0) return;

    (async () => {
      const ids = unseen.map((m) => m.id);
      const { error } = await supabase
        .from("messages")
        .update({ seen: true })
        .in("id", ids);
      if (error) console.warn("failed to mark seen:", error);
    })();
  }, [messages, user, selectedChat?.id]);

  if (!user) return <p>Please log in to view your messages.</p>;

  return (
    <div className="messages-page">
      <aside className="sidebar">
        <h3>Contacts</h3>
        {conversations.map((convo) => (
          <div
            className="contact"
            key={convo.id}
            onClick={() => navigate(`/messages/${convo.id}`)}
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
                      {selectedChat.ride?.from} ➞ {selectedChat.ride?.to}
                      <br />
                      {selectedChat.ride?.date && selectedChat.ride?.time && (
                        <>
                          <span>
                            {new Date(
                              selectedChat.ride.date
                            ).toLocaleDateString()}{" "}
                            at{" "}
                            {new Date(
                              `${selectedChat.ride.date}T${selectedChat.ride.time}`
                            ).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <br />
                        </>
                      )}
                      {selectedChat.ride?.seats && (
                        <span>{selectedChat.ride.seats} seat(s) available</span>
                      )}
                    </div>

                    {/* typing banner */}
                    {isPartnerTyping && (
                      <div className="typing-indicator" aria-live="polite">
                        {selectedChat.partnerNickname} is typing…
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                <div ref={chatEndRef} />
              </div>

              {/* Send form handles broadcasting your typing via upsert */}
              <SendMessageForm
                chatId={selectedChat.id}
                recipientId={selectedChat.partnerId}
                partnerName={selectedChat.partnerNickname}
                onNewMessage={(msg) => {
                  // optional: if you want to append immediately in the UI
                  // (your useChatMessages hook will also receive it via realtime)
                }}
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

// src/Messages/MessagesPage.jsx
// import { useEffect, useRef, useState } from "react";
// import { useNavigate, useParams } from "react-router-dom";
// import { useAuth } from "../Contexts/AuthContext";
// import useChatMessages from "../hooks/useChatMessages"; // 👈 use the hook
// import { supabase } from "../supabaseClient";
// import SendMessageForm from "./SendMessageForm";
// import "./Styles/MessagesPage.css";

// export default function MessagesPage() {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const { chatId } = useParams();

//   const [conversations, setConversations] = useState([]);
//   const [selectedChat, setSelectedChat] = useState(null);
//   const [partner, setPartner] = useState(null);
//   const chatEndRef = useRef(null);

//   // 🔄 realtime messages for the active chat
//   const { messages } = useChatMessages(chatId);

//   // Conversations list (left column)
//   useEffect(() => {
//     if (!user) return;

//     (async () => {
//       const { data: chats, error } = await supabase
//         .from("chats")
//         .select(
//           `
//           id,
//           user1,
//           user2,
//           ride_id,
//           user1_profile:profiles!chats_user1_fkey(nickname, avatar_url),
//           user2_profile:profiles!chats_user2_fkey(nickname, avatar_url),
//           rides (from, to, date, time, seats, notes, status)
//         `
//         )
//         .or(`user1.eq.${user.id},user2.eq.${user.id}`);

//       if (error) {
//         console.error("Error fetching chats:", error);
//         return;
//       }

//       const result = await Promise.all(
//         (chats || []).map(async (chat) => {
//           const isUser1 = chat.user1 === user.id;
//           const partnerProfile = isUser1
//             ? chat.user2_profile
//             : chat.user1_profile;

//           const { data: lastMsg } = await supabase
//             .from("messages")
//             .select("content, created_at, sender_id, recipient_id, seen")
//             .eq("chat_id", chat.id)
//             .order("created_at", { ascending: false })
//             .limit(1);

//           return {
//             ...chat,
//             partnerId: isUser1 ? chat.user2 : chat.user1,
//             partnerNickname: partnerProfile?.nickname || "Unknown",
//             partnerAvatar: partnerProfile?.avatar_url || null,
//             content: lastMsg?.[0]?.content || "(No messages yet)",
//             created_at: lastMsg?.[0]?.created_at || null,
//             isUnread:
//               lastMsg?.[0]?.recipient_id === user.id && !lastMsg?.[0]?.seen,
//             ride: chat.rides || null,
//           };
//         })
//       );

//       setConversations(
//         result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
//       );
//     })();
//   }, [user]);

//   // Load selected chat header (partner + ride details)
//   useEffect(() => {
//     if (!user || !chatId) return;

//     (async () => {
//       const chatIdInt = parseInt(chatId, 10);
//       const { data: chat, error } = await supabase
//         .from("chats")
//         .select(
//           `
//           id,
//           user1,
//           user2,
//           ride_id,
//           user1_profile:profiles!chats_user1_fkey(nickname, avatar_url),
//           user2_profile:profiles!chats_user2_fkey(nickname, avatar_url),
//           rides (from, to, date, time, seats, notes, status)
//         `
//         )
//         .eq("id", chatIdInt)
//         .single();

//       if (error || !chat) {
//         console.error("Chat not found:", error);
//         return;
//       }

//       const isUser1 = chat.user1 === user.id;
//       const partnerProfile = isUser1 ? chat.user2_profile : chat.user1_profile;

//       const chatData = {
//         ...chat,
//         partnerId: isUser1 ? chat.user2 : chat.user1,
//         partnerNickname: partnerProfile?.nickname || "Unknown",
//         partnerAvatar: partnerProfile?.avatar_url || null,
//         ride: chat.rides || null,
//       };

//       setSelectedChat(chatData);
//       setPartner({
//         id: chatData.partnerId,
//         nickname: chatData.partnerNickname,
//       });
//     })();
//   }, [chatId, user]);

//   // Auto-scroll on new messages
//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   // Mark newly received messages as seen (when they arrive)
//   useEffect(() => {
//     if (!user || !messages?.length || !selectedChat?.id) return;

//     const unseen = messages.filter(
//       (m) => m.recipient_id === user.id && !m.seen
//     );
//     if (unseen.length === 0) return;

//     (async () => {
//       const ids = unseen.map((m) => m.id);
//       const { error } = await supabase
//         .from("messages")
//         .update({ seen: true })
//         .in("id", ids);
//       if (error) console.warn("failed to mark seen:", error);
//     })();
//   }, [messages, user, selectedChat?.id]);

//   if (!user) return <p>Please log in to view your messages.</p>;

//   return (
//     <div className="messages-page">
//       <aside className="sidebar">
//         <h3>Contacts</h3>
//         {conversations.map((convo) => (
//           <div
//             className="contact"
//             key={convo.id}
//             onClick={() => navigate(`/messages/${convo.id}`)}
//           >
//             <div className="avatar">
//               {convo.partnerAvatar ? (
//                 <img src={convo.partnerAvatar} alt={convo.partnerNickname} />
//               ) : (
//                 <span>{convo.partnerNickname.charAt(0)}</span>
//               )}
//             </div>
//             <span>{convo.partnerNickname}</span>
//           </div>
//         ))}
//       </aside>

//       <main className="chat-preview">
//         {selectedChat ? (
//           <>
//             <div className="conversation-card">
//               <div className="top-line">
//                 <div className="top-left">
//                   <div className="avatar">
//                     {selectedChat.partnerAvatar ? (
//                       <img
//                         src={selectedChat.partnerAvatar}
//                         alt={selectedChat.partnerNickname}
//                       />
//                     ) : (
//                       <span>{selectedChat.partnerNickname.charAt(0)}</span>
//                     )}
//                   </div>
//                   <div>
//                     <strong>{selectedChat.partnerNickname}</strong>
//                     <div className="destination">
//                       {selectedChat.ride?.from} ➞ {selectedChat.ride?.to}
//                       <br />
//                       {selectedChat.ride?.date && selectedChat.ride?.time && (
//                         <>
//                           <span>
//                             {new Date(
//                               selectedChat.ride.date
//                             ).toLocaleDateString()}{" "}
//                             at{" "}
//                             {new Date(
//                               `${selectedChat.ride.date}T${selectedChat.ride.time}`
//                             ).toLocaleTimeString([], {
//                               hour: "2-digit",
//                               minute: "2-digit",
//                             })}
//                           </span>
//                           <br />
//                         </>
//                       )}
//                       {selectedChat.ride?.seats && (
//                         <span>{selectedChat.ride.seats} seat(s) available</span>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               <div className="chat-thread">
//                 {messages.map((msg) => {
//                   const isSender = msg.sender_id === user.id;
//                   return (
//                     <div
//                       key={msg.id}
//                       className={`chat-bubble ${isSender ? "sent" : "received"} ${
//                         !msg.seen && !isSender ? "unread" : ""
//                       }`}
//                     >
//                       <p>{msg.content}</p>
//                       <small>
//                         {new Date(msg.created_at).toLocaleTimeString([], {
//                           hour: "2-digit",
//                           minute: "2-digit",
//                         })}
//                         {isSender && (
//                           <>
//                             {" "}
//                             ✓
//                             <span
//                               className={`status-icon ${msg.seen ? "read" : ""}`}
//                             >
//                               {msg.seen ? "✓" : ""}
//                             </span>
//                           </>
//                         )}
//                       </small>
//                     </div>
//                   );
//                 })}
//                 <div ref={chatEndRef} />
//               </div>

//               {/* 👇 no onNewMessage — realtime hook handles inserts */}
//               <SendMessageForm
//                 chatId={selectedChat.id}
//                 recipientId={selectedChat.partnerId}
//               />
//             </div>
//           </>
//         ) : (
//           <h2>Your Conversations</h2>
//         )}
//       </main>
//     </div>
//   );
// }
