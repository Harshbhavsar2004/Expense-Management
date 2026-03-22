"use client";

import { RefObject } from "react";
import type { ChatMessage } from "@/types";
import MessageBubble from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export default function MessageList({ messages, messagesEndRef }: MessageListProps) {
  return (
    <div style={{
      width: "100%",
      padding: "32px 32px 12px",
      display: "flex", flexDirection: "column", gap: "0",
    }}>
      {messages.map((msg, idx) => (
        <MessageBubble key={msg.id} msg={msg} idx={idx} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
