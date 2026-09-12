"use client";

import React from "react";
import { ChatMessage } from "@/types/chat";
import { TimestampPill } from "./TimestampPill";
import { EvidenceCard } from "./EvidenceCard";
import { cn } from "@/lib/cn";

const TIMESTAMP_RE = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
const EMPHASIS_RE = /(\*\*.*?\*\*|\*.*?\*)/g;

/** Turns [mm:ss] into seek buttons and **bold** / *italic* into markup. */
function renderContent(content: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  TIMESTAMP_RE.lastIndex = 0;

  const pushText = (text: string, key: string) => {
    parts.push(
      <span key={key}>
        {text.split(EMPHASIS_RE).map((sub, j) => {
          if (sub.startsWith("**") && sub.endsWith("**")) return <strong key={j} className="font-medium">{sub.slice(2, -2)}</strong>;
          if (sub.startsWith("*") && sub.endsWith("*")) return <em key={j}>{sub.slice(1, -1)}</em>;
          return sub;
        })}
      </span>
    );
  };

  while ((match = TIMESTAMP_RE.exec(content)) !== null) {
    if (match.index > last) pushText(content.slice(last, match.index), `t${last}`);
    parts.push(<TimestampPill key={`ts${match.index}`} timestamp={match[1]} />);
    last = match.index + match[0].length;
  }
  if (last < content.length) pushText(content.slice(last), `t${last}`);
  return parts;
}

export function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-primary-container px-4 py-2.5 text-sm text-primary-on-container">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4285f4] via-[#9b72cb] to-[#d96570]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className={cn("whitespace-pre-line text-sm leading-6 text-on-surface")}>{renderContent(message.content)}</div>

        {message.citations && message.citations.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-on-muted">From the video</div>
            {message.citations.map((c) => (
              <EvidenceCard key={c.id} citation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
