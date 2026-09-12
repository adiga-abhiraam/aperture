"use client";

import React, { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ChatInputProps {
  onSendMessage: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, isLoading = false, placeholder = "Ask about this video", disabled = false }: ChatInputProps) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const canSend = Boolean(text.trim()) && !isLoading && !disabled;

  const send = () => {
    if (!canSend) return;
    onSendMessage(text.trim());
    setText("");
    if (ref.current) ref.current.style.height = "auto";
  };

  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-[28px] bg-surface-container py-2 pl-5 pr-2 transition-colors",
        "focus-within:bg-surface focus-within:shadow-e1",
        disabled && "opacity-60"
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        value={text}
        disabled={disabled || isLoading}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        aria-label="Message"
        className="max-h-[140px] min-h-[24px] w-full resize-none bg-transparent py-1.5 text-sm leading-6 text-on-surface placeholder:text-on-muted focus:outline-none"
      />
      <button
        type="button"
        onClick={send}
        disabled={!canSend}
        aria-label="Send"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
          canSend ? "bg-primary text-primary-on hover:bg-primary-hover" : "bg-surface-high text-on-muted"
        )}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </div>
  );
}
