"use client";

import React from "react";
import { SearchX } from "lucide-react";
import { Video } from "@/types/video";
import { Button } from "@/components/ui/Button";
import { VideoCard } from "./VideoCard";
import { cn } from "@/lib/cn";

export interface VideoGridProps {
  videos: Video[];
  layout?: "grid" | "list";
  onResetFilters?: () => void;
  onStartProcessing?: (id: string) => Promise<unknown>;
  onDelete?: (video: Video) => void;
  className?: string;
}

export function VideoGrid({ videos, layout = "grid", onResetFilters, onStartProcessing, onDelete, className }: VideoGridProps) {
  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-muted">
          <SearchX className="h-8 w-8" />
        </div>
        <h3 className="mt-5 text-lg text-on-surface">No videos match</h3>
        <p className="mt-1 max-w-sm text-sm text-on-muted">Try a different search or clear the filters.</p>
        {onResetFilters && (
          <Button variant="text" onClick={onResetFilters} className="mt-4">
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        layout === "grid"
          ? "grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          : "flex flex-col gap-1",
        className
      )}
    >
      {videos.map((video, index) => (
        <VideoCard key={video.id} video={video} layout={layout} onStartProcessing={onStartProcessing} onDelete={onDelete} index={index} />
      ))}
    </div>
  );
}
