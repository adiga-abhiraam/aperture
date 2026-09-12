"use client";

import React, { useState } from "react";
import { Play, Share2, Check, Loader2, Info, Trash2 } from "lucide-react";
import { Video } from "@/types/video";
import { StatusBadge } from "@/features/processing-status";
import { Button } from "@/components/ui/Button";
import { formatRelativeDate, formatDuration } from "@/lib/formatters";

export interface VideoHeaderProps {
  video: Video;
  onOpenProcessingDetails?: () => void;
  onStartProcessing?: () => Promise<unknown>;
  onDelete?: () => void;
}

export function VideoHeader({ video, onOpenProcessingDetails, onStartProcessing, onDelete }: VideoHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const startProcessing = async () => {
    if (!onStartProcessing) return;
    setStarting(true);
    setStartError(null);
    try {
      await onStartProcessing();
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start processing");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-medium leading-7 text-on-surface sm:text-[22px]">{video.title}</h1>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3 text-[13px] text-on-muted">
          <StatusBadge status={video.status} progressPercent={video.processingDetails.progressPercent} />
          <span>{formatRelativeDate(video.uploadedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDuration(video.duration)}</span>
        </div>

        <div className="flex items-center gap-2">
          {(video.status === "not_processed" || video.status === "failed") && (
            <Button variant="filled" size="sm" onClick={startProcessing} disabled={starting}>
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {video.status === "failed" ? "Retry processing" : "Process video"}
            </Button>
          )}
          <Button variant="outlined" size="sm" onClick={share}>
            {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
            {copied ? "Link copied" : "Share"}
          </Button>
          <Button variant="icon" onClick={onOpenProcessingDetails} aria-label="Processing details" title="Processing details">
            <Info className="h-5 w-5" />
          </Button>
          {onDelete && (
            <Button
              variant="icon"
              onClick={onDelete}
              disabled={video.status === "processing"}
              aria-label="Delete video"
              title={video.status === "processing" ? "Wait for processing to finish" : "Delete video"}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {startError && (
        <div className="flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-xs text-error">
          <span>{startError}</span>
        </div>
      )}
    </div>
  );
}
