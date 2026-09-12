"use client";

import React, { useEffect, useRef } from "react";
import { ChatMessage } from "@/types/chat";
import { MessageItem } from "./MessageItem";

export interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  emptyState?: React.ReactNode;
}

export function MessageList({ messages, isLoading = false, emptyState }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
      {messages.length === 0 && emptyState}

      {messages.map((m) => (
        <MessageItem key={m.id} message={m} />
      ))}

      {isLoading && (
        <div className="flex items-center gap-3" aria-live="polite">
          <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570]" />
          <span className="space-y-2">
            <span className="block h-3 w-56 animate-pulse rounded-full bg-surface-high" />
            <span className="block h-3 w-40 animate-pulse rounded-full bg-surface-high" />
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
