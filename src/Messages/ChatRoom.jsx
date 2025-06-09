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
import { useParams } from "react-router-dom";
import { useAuth } from "../Contexts/AuthContext";
import { db } from "../firebase"; // updated import
import SendMessageForm from "./SendMessageForm";
import "./Styles/ChatRoom.css";

export default function ChatRoom() {
  const { user } = useAuth();
  const { partnerId } = useParams();
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!user || !partnerId) return;

    const messagesRef = collection(db, "messages");

    const q1 = query(
      messagesRef,
      where("senderId", "==", user.uid),
      where("recipientId", "==", partnerId),
      orderBy("createdAt", "asc")
    );

    const q2 = query(
      messagesRef,
      where("senderId", "==", partnerId),
      where("recipientId", "==", user.uid),
      orderBy("createdAt", "asc")
    );

    const fetchMessages = async () => {
      const snapshot1 = await getDocs(q1);
      const snapshot2 = await getDocs(q2);

      let msgs = [
        ...snapshot1.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        ...snapshot2.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      ];

      msgs.sort((a, b) => a.createdAt.seconds - b.createdAt.seconds);
      setMessages(msgs);

      // Mark unseen messages as seen
      const unseen = msgs.filter(
        (msg) => msg.recipientId === user.uid && !msg.seen
      );

      if (unseen.length > 0) {
        unseen.forEach(async (msg) => {
          const msgDocRef = doc(db, "messages", msg.id);
          await updateDoc(msgDocRef, { seen: true });
        });
      }
    };

    fetchMessages();

    // Real-time listeners for new messages
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

    return () => {
      unsub1();
      unsub2();
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
          const isSender = msg.senderId === user.uid;
          const currentDate = new Date(
            msg.createdAt.seconds * 1000
          ).toDateString();
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
                    {isSender ? "You" : msg.senderName || msg.senderId}
                  </strong>
                  <small>
                    {new Date(
                      msg.createdAt.seconds * 1000
                    ).toLocaleTimeString()}
                  </small>
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
