"use client";

import React from "react";
import { RotateCcw } from "lucide-react";
import { Video } from "@/types/video";
import { Button } from "@/components/ui/Button";
import { useVideoChat } from "../hooks/useVideoChat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { cn } from "@/lib/cn";

export interface ChatPanelProps {
  video: Video;
  className?: string;
}

/** Aperture mark, larger, for the empty conversation. */
function ApertureMark() {
  return (
    <svg width="56" height="56" viewBox="0 0 28 28" fill="none" aria-hidden="true" className="animate-scale-in">
      <circle cx="14" cy="14" r="12" className="stroke-primary" strokeWidth="2" />
      <path
        d="M14 2v12l10.4 6M14 14L3.6 20M14 14l10.4-6M14 14v12M14 14L3.6 8"
        className="stroke-primary"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChatPanel({ video, className }: ChatPanelProps) {
  const { messages, isLoading, sendMessage, clearChat } = useVideoChat(video);
  const ready = video.status === "preprocessed";

  const placeholder = !ready
    ? video.status === "processing"
      ? "Available once processing finishes"
      : "Process the video to ask questions"
    : "Ask about this video";

  return (
    <section
      aria-label="Ask about this video"
      className={cn("flex flex-col overflow-hidden border-l border-outline-variant bg-surface", className)}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-outline-variant px-4">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-medium text-on-surface">Chat</h2>
          <p className="truncate text-xs text-on-muted" title={video.title}>
            {video.title}
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="icon" size="sm" onClick={clearChat} aria-label="New chat" title="New chat">
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </header>

      <MessageList
        messages={messages}
        isLoading={isLoading}
        emptyState={
          <div className="flex h-full flex-col items-center justify-center px-6 text-center animate-fade-in">
            <ApertureMark />
            <h3 className="mt-5 text-xl font-normal text-on-surface">Ask about this video</h3>
            <p className="mt-2 max-w-[260px] text-sm text-on-muted">
              {ready
                ? "What's said, what's shown, or when something happens — every answer links to a moment in the video."
                : "Process the video first, then ask what's said, what's shown, and when things happen."}
            </p>
          </div>
        }
      />

      <div className="shrink-0 px-3 pb-3 pt-1">
        <ChatInput onSendMessage={sendMessage} isLoading={isLoading} disabled={!ready} placeholder={placeholder} />
        <p className="mt-2 text-center text-[11px] text-on-muted">Answers come only from this video&apos;s transcript and frames.</p>
      </div>
    </section>
  );
}
