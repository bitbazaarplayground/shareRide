// SendMessageForm.jsx
import { useState } from "react";
import { useAuth } from "../Contexts/AuthContext";
import { supabase } from "../supabaseClient";

export default function SendMessageForm({ recipientId }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");

  const handleSend = async () => {
    if (!message.trim()) return;

    const { error } = await supabase.from("messages").insert([
      {
        sender_id: user.id,
        recipient_id: recipientId,
        content: message,
      },
    ]);

    if (error) {
      console.error("Failed to send message:", error);
    } else {
      setMessage("");
    }
  };

  return (
    <div>
      <textarea
        rows="3"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message"
      />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
