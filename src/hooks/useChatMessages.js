// src/hooks/useChatMessages.js
// src/hooks/useChatMessages.js
import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

export default function useChatMessages(chatId) {
  const [messages, setMessages] = useState([]);
  const channelRef = useRef(null);
  const seenIds = useRef(new Set());

  useEffect(() => {
    const cid = Number(chatId);
    if (!Number.isFinite(cid)) return;

    let canceled = false;

    // 1) initial load
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", cid)
        .order("created_at", { ascending: true });

      if (!canceled && !error && data) {
        data.forEach((m) => seenIds.current.add(m.id));
        setMessages(data);
      }
    })();

    // 2) Realtime subscription
    const channel = supabase.channel(`messages:chat_${cid}`);

    // INSERTS
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${cid}`, // numeric filter
      },
      (payload) => {
        const msg = payload.new;
        if (seenIds.current.has(msg.id)) return; // de-dupe
        seenIds.current.add(msg.id);
        setMessages((prev) => [...prev, msg]);
      }
    );

    // UPDATES (e.g., seen flag)
    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${cid}`,
      },
      (payload) => {
        const updated = payload.new;
        setMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? updated : m))
        );
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      canceled = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [chatId]);

  return { messages, setMessages };
}

// import { useEffect, useRef, useState } from "react";
// import { supabase } from "../supabaseClient";

// export default function useChatMessages(chatId) {
//   const [messages, setMessages] = useState([]);
//   const channelRef = useRef(null);
//   const seenIds = useRef(new Set());

//   useEffect(() => {
//     if (!chatId) return;

//     let canceled = false;

//     // 1) initial load
//     (async () => {
//       const { data, error } = await supabase
//         .from("messages")
//         .select("*")
//         .eq("chat_id", chatId)
//         .order("created_at", { ascending: true });

//       if (!canceled && !error && data) {
//         data.forEach((m) => seenIds.current.add(m.id));
//         setMessages(data);
//       }
//     })();

//     // 2) Realtime subscription
//     const channel = supabase.channel(`messages:chat_${chatId}`);

//     // INSERTS
//     channel.on(
//       "postgres_changes",
//       {
//         event: "INSERT",
//         schema: "public",
//         table: "messages",
//         filter: `chat_id=eq.${chatId}`,
//       },
//       (payload) => {
//         const msg = payload.new;
//         if (seenIds.current.has(msg.id)) return; // de-dupe
//         seenIds.current.add(msg.id);
//         setMessages((prev) => [...prev, msg]);
//       }
//     );

//     // UPDATES (e.g., seen flag, edits)
//     channel.on(
//       "postgres_changes",
//       {
//         event: "UPDATE",
//         schema: "public",
//         table: "messages",
//         filter: `chat_id=eq.${chatId}`,
//       },
//       (payload) => {
//         const updated = payload.new;
//         setMessages((prev) =>
//           prev.map((m) => (m.id === updated.id ? updated : m))
//         );
//       }
//     );

//     channel.subscribe();
//     channelRef.current = channel;

//     return () => {
//       canceled = true;
//       if (channelRef.current) supabase.removeChannel(channelRef.current);
//     };
//   }, [chatId]);

//   return { messages, setMessages };
// }
