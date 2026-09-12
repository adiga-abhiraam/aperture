"use client";

import React from "react";
import { useVideoPlayerContext } from "@/features/video-player";
import { cn } from "@/lib/cn";
import { parseTimestampToSeconds, formatDuration } from "@/lib/formatters";

export interface TimestampPillProps {
  timestamp: string | number; // "01:24" or 84
  description?: string;
  className?: string;
}

/** Inline clickable timestamp, styled like a YouTube description link. */
export function TimestampPill({ timestamp, description, className }: TimestampPillProps) {
  const { seekTo } = useVideoPlayerContext();
  const seconds = typeof timestamp === "number" ? timestamp : parseTimestampToSeconds(timestamp);
  const label = typeof timestamp === "string" ? timestamp : formatDuration(timestamp);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        seekTo(seconds, description);
      }}
      title={description ? `${label} · ${description}` : `Jump to ${label}`}
      className={cn(
        "inline-flex items-center rounded-md bg-primary-container px-1.5 py-px align-baseline text-[13px] font-medium tabular-nums text-primary-on-container transition-colors hover:brightness-95 dark:hover:brightness-110",
        className
      )}
    >
      {label}
    </button>
  );
}
