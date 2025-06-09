import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { db } from "../firebase"; // updated import
import SendMessageForm from "./SendMessageForm";
import "./Styles/MessagesPage.css";

export default function MessagesPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const messagesRef = collection(db, "messages");

    const q1 = query(
      messagesRef,
      where("senderId", "==", user.uid),
      orderBy("createdAt", "asc")
    );
    const q2 = query(
      messagesRef,
      where("recipientId", "==", user.uid),
      orderBy("createdAt", "asc")
    );

    const fetchMessages = async () => {
      const snap1 = await getDocs(q1);
      const snap2 = await getDocs(q2);

      let allMsgs = [
        ...snap1.docs.map((d) => ({ id: d.id, ...d.data() })),
        ...snap2.docs.map((d) => ({ id: d.id, ...d.data() })),
      ];

      allMsgs.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds);
      setMessages(allMsgs);

      const unseenMsgs = allMsgs.filter(
        (msg) => msg.recipientId === user.uid && !msg.seen
      );

      if (unseenMsgs.length > 0) {
        unseenMsgs.forEach(async (msg) => {
          const msgDocRef = doc(db, "messages", msg.id);
          await updateDoc(msgDocRef, { seen: true });
        });
      }
    };

    fetchMessages();

    const unsub1 = onSnapshot(q1, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          setMessages((prev) => {
            if (prev.find((m) => m.id === change.doc.id)) return prev;
            return [...prev, { id: change.doc.id, ...change.doc.data() }].sort(
              (a, b) => a.createdAt.seconds - b.createdAt.seconds
            );
          });
        }
      });
    });

    const unsub2 = onSnapshot(q2, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          setMessages((prev) => {
            if (prev.find((m) => m.id === change.doc.id)) return prev;
            return [...prev, { id: change.doc.id, ...change.doc.data() }].sort(
              (a, b) => a.createdAt.seconds - b.createdAt.seconds
            );
          });
        }
      });
    });

    // Typing status listener (optional - adjust if you track typing status)
    const typingStatusDocId = `${user.uid}_somePartnerId`; // adjust as needed
    const typingRef = doc(db, "typingStatus", typingStatusDocId);

    const unsubscribeTyping = onSnapshot(typingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.recipientId === user.uid) {
          setIsTyping(data.isTyping);
        }
      }
    });

    return () => {
      unsub1();
      unsub2();
      unsubscribeTyping();
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!user) return <p>Please log in to view your messages.</p>;

  let lastDate = "";

  return (
    <div className="messages-page">
      <h2>Your Messages</h2>

      <div className="message-thread">
        {messages.map((msg) => {
          const isSender = msg.senderId === user.uid;
          const partner = isSender
            ? { id: msg.recipientId, name: msg.recipientName }
            : { id: msg.senderId, name: msg.senderName };
          const partnerId = partner.id;

          const currentDate = new Date(
            msg.createdAt.seconds * 1000
          ).toDateString();
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
                    {partner.name || partnerId}
                  </Link>{" "}
                  <small>
                    (
                    {new Date(
                      msg.createdAt.seconds * 1000
                    ).toLocaleTimeString()}
                    )
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

        {isTyping && <p className="typing-indicator">User is typing...</p>}

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
