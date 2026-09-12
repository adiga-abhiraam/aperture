"use client";

import { useCallback, useEffect, useState } from "react";
import { ChatMessage } from "@/types/chat";
import { Video } from "@/types/video";
import { chatService } from "@/services/chatService";
import { useProcessingSettings } from "@/features/settings";

export function useVideoChat(video: Video) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { ensureSession } = useProcessingSettings();

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
        let runtimeSessionId: string | undefined;
        if (video.profileId === "api-gemini-free-v1") {
          try {
            runtimeSessionId = await ensureSession();
          } catch (err) {
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                videoId: video.id,
                role: "assistant",
                content: `This video was processed with the cloud API, so searching it needs your Gemini key. ${err instanceof Error ? err.message : ""}`,
                createdAt: new Date().toISOString(),
              },
            ]);
            return;
          }
        }
        const reply = await chatService.ask(video, text, { runtimeSessionId });
        setMessages((prev) => [...prev, reply]);
      } finally {
        setIsLoading(false);
      }
    },
    [video, isLoading, ensureSession]
  );

  const clearChat = useCallback(() => setMessages([]), []);

  return { messages, isLoading, sendMessage, clearChat };
}
