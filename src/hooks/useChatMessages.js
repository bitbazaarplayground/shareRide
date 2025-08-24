// src/hooks/useChatMessages.js
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

export default function useChatMessages(chatId) {
  const [messages, setMessages] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!chatId) return;

    let canceled = false;

    // 1) initial load
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });
      if (!canceled && !error && data) setMessages(data);
    })();

    // 2) subscribe to new messages
    const channel = supabase
      .channel(`messages:chat_${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      canceled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [chatId]);

  return { messages, setMessages };
}
