"use client";

import React, { useState } from "react";
import { isPlaceholderThumbnail } from "@/lib/thumbnail";
import { cn } from "@/lib/cn";

export interface VideoThumbnailProps {
  thumbnailUrl?: string;
  videoUrl: string;
  className?: string;
}

/**
 * Shows the stored poster (captured first frame). Older entries that only
 * have a placeholder fall back to the browser rendering the video's own
 * first frame via a paused, metadata-only <video>.
 */
export function VideoThumbnail({ thumbnailUrl, videoUrl, className }: VideoThumbnailProps) {
  const [failed, setFailed] = useState(false);
  if (failed || isPlaceholderThumbnail(thumbnailUrl)) {
    return (
      <video
        src={`${videoUrl}#t=0.5`}
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
        className={cn("pointer-events-none h-full w-full object-cover", className)}
      />
    );
  }
  return (
    <img
      src={thumbnailUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
