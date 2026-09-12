"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatMessage } from "@/types/chat";
import { Video } from "@/types/video";
import { chatService } from "@/services/chatService";

export function useVideoChat(video: Video) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMessages(chatService.history(video));
  }, [video.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    async (query: string) => {
      const text = query.trim();
      if (!text || isLoading) return;
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, videoId: video.id, role: "user", content: text, createdAt: new Date().toISOString() },
      ]);
      setIsLoading(true);
      try {
        const reply = await chatService.ask(video, text);
        setMessages((prev) => [...prev, reply]);
      } finally {
        setIsLoading(false);
      }
    },
    [video, isLoading]
  );

  const clearChat = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearChat };
}
