"use client";

import React from "react";
import { VisualDetection } from "@/types/video";
import { useVideoPlayerContext } from "@/features/video-player";
import { formatDuration } from "@/lib/formatters";
import { cn } from "@/lib/cn";

export interface VisualTimelineProps {
  detections: VisualDetection[];
  className?: string;
}

const CATEGORY_LABEL: Record<VisualDetection["category"], string> = {
  object: "Object",
  person: "Person",
  vehicle: "Vehicle",
  action: "Action",
  scene: "Scene",
};

export function VisualTimeline({ detections, className }: VisualTimelineProps) {
  const { seekTo, currentTime } = useVideoPlayerContext();

  if (detections.length === 0) {
    return <p className={cn("py-10 text-center text-sm text-on-muted", className)}>No visual moments yet. Process the video to detect them.</p>;
  }

  return (
    <ol className={cn("max-h-[28rem] overflow-y-auto", className)}>
      {detections.map((item) => {
        const near = Math.abs(currentTime - item.timestamp) < 5;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => seekTo(item.timestamp, item.label)}
              className={cn(
                "flex w-full items-start gap-4 rounded-lg px-3 py-2.5 text-left transition-colors",
                near ? "bg-primary-container" : "hover:bg-surface-container"
              )}
            >
              <span className={cn("mt-0.5 w-11 shrink-0 text-[13px] tabular-nums", near ? "font-medium text-primary-on-container" : "text-primary")}>
                {formatDuration(item.timestamp)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn("text-sm font-medium", near ? "text-primary-on-container" : "text-on-surface")}>{item.label}</span>
                  <span className="rounded bg-surface-high px-1.5 py-px text-[11px] text-on-variant">{CATEGORY_LABEL[item.category]}</span>
                  <span className="ml-auto text-xs tabular-nums text-on-muted">{Math.round(item.confidence * 100)}%</span>
                </span>
                <span className="mt-0.5 block text-[13px] text-on-muted">{item.description}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
