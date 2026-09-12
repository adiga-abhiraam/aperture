"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { Video } from "@/types/video";
import { StatusBadge } from "@/features/processing-status";
import { Button } from "@/components/ui/Button";
import { formatDuration, formatRelativeDate } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import { VideoThumbnail } from "./VideoThumbnail";

export interface VideoCardProps {
  video: Video;
  layout?: "grid" | "list";
  onStartProcessing?: (id: string) => Promise<unknown>;
  onDelete?: (video: Video) => void;
  /** Position in the list, used to stagger the entrance animation. */
  index?: number;
}

export function VideoCard({ video, layout = "grid", onStartProcessing, onDelete, index = 0 }: VideoCardProps) {
  const isList = layout === "list";
  const [starting, setStarting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const href = `/videos/${video.id}`;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // YouTube-style overflow menu; visible on hover/focus and while open.
  const overflow = onDelete && (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.preventDefault();
          setMenuOpen((v) => !v);
        }}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-on-variant state-layer transition-opacity",
          menuOpen ? "opacity-100" : "opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100"
        )}
      >
        <MoreVertical className="h-5 w-5" />
      </button>
      {menuOpen && (
        <div role="menu" className="absolute right-0 top-10 z-20 w-44 rounded-xl bg-surface-low py-1 shadow-e3 animate-scale-in origin-top-right">
          <button
            type="button"
            role="menuitem"
            disabled={video.status === "processing"}
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              onDelete(video);
            }}
            className="flex h-10 w-full items-center gap-3 px-4 text-sm text-on-surface state-layer disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4 text-on-variant" />
            Delete
          </button>
        </div>
      )}
    </div>
  );

  const startProcessing = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!onStartProcessing) return;
    setStarting(true);
    try {
      await onStartProcessing(video.id);
    } catch (err) {
      console.error("Failed to start processing video:", err);
    } finally {
      setStarting(false);
    }
  };

  const thumbnail = (
    <Link
      href={href}
      className={cn(
        "group/thumb relative block shrink-0 overflow-hidden rounded-xl bg-surface-high",
        isList ? "aspect-video w-48 sm:w-60" : "aspect-video w-full"
      )}
    >
      <VideoThumbnail
        thumbnailUrl={video.thumbnailUrl}
        videoUrl={video.videoUrl}
        className="transition-transform duration-300 group-hover/thumb:scale-[1.03]"
      />
      <span className="absolute inset-0 bg-black/0 transition-colors group-hover/thumb:bg-black/10" />
      <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
        {formatDuration(video.duration)}
      </span>
      <span className="absolute left-2 top-2">
        <StatusBadge status={video.status} progressPercent={video.processingDetails.progressPercent} size="sm" elevated />
      </span>
    </Link>
  );

  const secondaryAction =
    video.status === "not_processed" ? (
      <Button variant="tonal" size="sm" onClick={startProcessing} disabled={starting}>
        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Process
      </Button>
    ) : null;

  const entrance = { className: "animate-fade-in", style: { animationDelay: `${Math.min(index, 12) * 40}ms` } };

  if (isList) {
    return (
      <article {...entrance} className={cn(entrance.className, "group/card flex gap-4 rounded-2xl p-2 transition-colors hover:bg-surface-container")}>
        {thumbnail}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1">
          <Link href={href} className="line-clamp-2 text-base text-on-surface hover:underline">
            {video.title}
          </Link>
          <div className="text-[13px] text-on-muted">{formatRelativeDate(video.uploadedAt)}</div>
          <p className="line-clamp-2 text-[13px] text-on-variant">{video.description}</p>
          {secondaryAction && <div className="pt-1">{secondaryAction}</div>}
        </div>
        {overflow}
      </article>
    );
  }

  return (
    <article {...entrance} className={cn(entrance.className, "group/card flex flex-col gap-3")}>
      {thumbnail}
      <div className="flex items-start gap-3 px-0.5">
        <div className="min-w-0 flex-1">
          <Link href={href} className="line-clamp-2 text-[15px] font-medium leading-5 text-on-surface hover:underline">
            {video.title}
          </Link>
          <div className="mt-1 text-[13px] text-on-muted">{formatRelativeDate(video.uploadedAt)}</div>
        </div>
        {secondaryAction}
        {overflow}
      </div>
    </article>
  );
}
