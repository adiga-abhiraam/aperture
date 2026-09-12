"use client";

import React from "react";
import { Eye, Mic, Volume2 } from "lucide-react";
import { EvidenceCitation } from "@/types/chat";
import { useVideoPlayerContext } from "@/features/video-player";
import { cn } from "@/lib/cn";

const TYPE_META = {
  visual: { icon: Eye, label: "Visual" },
  transcript: { icon: Mic, label: "Speech" },
  audio: { icon: Volume2, label: "Audio" },
} as const;

/** One piece of grounding evidence: where in the video, which modality, how sure. */
export function EvidenceCard({ citation, className }: { citation: EvidenceCitation; className?: string }) {
  const { seekTo } = useVideoPlayerContext();
  const { icon: Icon, label } = TYPE_META[citation.type];
  const confidence = Math.round(citation.confidence * 100);

  return (
    <button
      type="button"
      onClick={() => seekTo(citation.timestamp, citation.snippet)}
      className={cn(
        "flex w-full items-stretch gap-3 overflow-hidden rounded-xl bg-surface text-left shadow-e1 transition-shadow hover:shadow-e2",
        className
      )}
    >
      {citation.thumbnailUrl && citation.type === "visual" ? (
        <img src={citation.thumbnailUrl} alt="" className="h-[68px] w-[120px] shrink-0 object-cover" />
      ) : (
        <span className="flex w-12 shrink-0 items-center justify-center bg-surface-container text-on-variant">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2 pr-3">
        <span className="flex items-center gap-2 text-xs text-on-muted">
          <span className="font-medium tabular-nums text-primary">{citation.timestampLabel}</span>
          <span>{label}</span>
          <span className="ml-auto tabular-nums">{confidence}%</span>
        </span>
        <span className="line-clamp-2 text-[13px] leading-[18px] text-on-surface">{citation.snippet}</span>
      </span>
    </button>
  );
}
