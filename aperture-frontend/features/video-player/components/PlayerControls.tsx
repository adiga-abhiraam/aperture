import React from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, RotateCw } from "lucide-react";
import { formatDuration } from "@/lib/formatters";
import { cn } from "@/lib/cn";

export interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  className?: string;
}

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/15 hover:text-white";

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
  className,
}: PlayerControlsProps) {
  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pb-2 pt-10 transition-opacity duration-200",
        className
      )}
    >
      {/* Scrubber */}
      <div className="group/scrub relative flex h-5 cursor-pointer items-center">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          aria-label="Seek"
          className="absolute inset-0 z-10 w-full cursor-pointer opacity-0"
        />
        <div className="relative h-1 w-full overflow-visible rounded-full bg-white/30 transition-[height] group-hover/scrub:h-1.5">
          <div className="h-full rounded-full bg-[rgb(var(--c-primary))]" style={{ width: `${percent}%` }} />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-[rgb(var(--c-primary))] transition-transform group-hover/scrub:scale-100"
            style={{ left: `${percent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={onTogglePlay} className={iconBtn} aria-label={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>
          <button type="button" onClick={() => onSeek(Math.max(0, currentTime - 10))} className={iconBtn} aria-label="Back 10 seconds">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => onSeek(Math.min(duration, currentTime + 10))} className={iconBtn} aria-label="Forward 10 seconds">
            <RotateCw className="h-4 w-4" />
          </button>

          <div className="group/vol ml-1 flex items-center">
            <button type="button" onClick={onToggleMute} className={iconBtn} aria-label={isMuted ? "Unmute" : "Mute"}>
              {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              aria-label="Volume"
              className="h-1 w-0 cursor-pointer opacity-0 transition-all duration-200 group-hover/vol:ml-1 group-hover/vol:w-20 group-hover/vol:opacity-100"
            />
          </div>

          <span className="ml-3 text-[13px] tabular-nums text-white/90">
            {formatDuration(currentTime)} <span className="text-white/50">/</span> {formatDuration(duration)}
          </span>
        </div>

        <button type="button" onClick={onToggleFullscreen} className={iconBtn} aria-label="Full screen">
          <Maximize className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
