import React from "react";
import { SeekNotification } from "../context/VideoPlayerContext";

/** Brief toast inside the player confirming a jump from chat or transcript. */
export function TimestampSeekOverlay({ notification }: { notification: SeekNotification | null }) {
  if (!notification) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 animate-fade-in">
      <div className="flex max-w-xs items-center gap-2 rounded-full bg-black/75 px-3 py-1.5 text-[13px] text-white backdrop-blur">
        <span className="font-medium tabular-nums">{notification.label}</span>
        {notification.description && <span className="truncate text-white/80">{notification.description}</span>}
      </div>
    </div>
  );
}
