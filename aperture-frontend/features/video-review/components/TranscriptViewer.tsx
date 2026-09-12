"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { TranscriptSegment } from "@/types/video";
import { useVideoPlayerContext } from "@/features/video-player";
import { formatDuration } from "@/lib/formatters";
import { cn } from "@/lib/cn";

export interface TranscriptViewerProps {
  transcripts: TranscriptSegment[];
  className?: string;
}

export function TranscriptViewer({ transcripts, className }: TranscriptViewerProps) {
  const [filter, setFilter] = useState("");
  const { currentTime, seekTo } = useVideoPlayerContext();
  const activeRef = useRef<HTMLButtonElement>(null);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return transcripts;
    return transcripts.filter((t) => t.text.toLowerCase().includes(q) || t.speaker?.toLowerCase().includes(q));
  }, [transcripts, filter]);

  // Keep the current line in view while the video plays.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentTime]);

  return (
    <div className={cn("flex flex-col", className)}>
      {transcripts.length > 0 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-on-muted" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search transcript"
            className="h-10 w-full rounded-full bg-surface-container pl-10 pr-4 text-sm text-on-surface placeholder:text-on-muted focus:bg-surface focus:shadow-e1 focus:outline-none"
          />
        </div>
      )}

      <div className="max-h-[28rem] overflow-y-auto">
        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-on-muted">
            {transcripts.length === 0 ? "No transcript yet. Process the video to generate one." : "Nothing matches."}
          </p>
        ) : (
          <ol>
            {visible.map((seg) => {
              const current = currentTime >= seg.start && currentTime < seg.end;
              return (
                <li key={seg.id}>
                  <button
                    ref={current ? activeRef : undefined}
                    type="button"
                    onClick={() => seekTo(seg.start, seg.text.slice(0, 40))}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-lg px-3 py-2 text-left transition-colors",
                      current ? "bg-primary-container" : "hover:bg-surface-container"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 w-11 shrink-0 text-[13px] tabular-nums",
                        current ? "font-medium text-primary-on-container" : "text-primary"
                      )}
                    >
                      {formatDuration(seg.start)}
                    </span>
                    <span className="min-w-0 flex-1">
                      {seg.speaker && <span className="mr-2 text-[13px] font-medium text-on-variant">{seg.speaker}</span>}
                      <span className={cn("text-sm", current ? "text-primary-on-container" : "text-on-surface")}>{seg.text}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
