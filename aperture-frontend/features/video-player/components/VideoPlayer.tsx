"use client";

import React, { useRef, useState, useEffect } from "react";
import { useVideoPlayerContext } from "../context/VideoPlayerContext";
import { PlayerControls } from "./PlayerControls";
import { TimestampSeekOverlay } from "./TimestampSeekOverlay";
import { Video } from "@/types/video";

export interface VideoPlayerProps {
  video: Video;
  className?: string;
}

export function VideoPlayer({ video, className }: VideoPlayerProps) {
  const {
    videoRef,
    currentTime,
    duration,
    isPlaying,
    volume,
    isMuted,
    seekNotification,
    seekTo,
    togglePlay,
    setVolume,
    toggleMute,
    setCurrentTime,
    setDuration,
    setIsPlaying,
  } = useVideoPlayerContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        seekTo(Math.max(0, currentTime - 5));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        seekTo(Math.min(duration, currentTime + 5));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekTo, currentTime, duration]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className={`group relative aspect-video w-full overflow-hidden rounded-xl bg-black ${className || ""}`}
    >
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        src={video.videoUrl}
        poster={video.thumbnailUrl}
        playsInline
        onClick={togglePlay}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || video.duration);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Floating HUD timestamp seek alert */}
      <TimestampSeekOverlay notification={seekNotification} />

      {/* Controls Overlay */}
      <PlayerControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration || video.duration}
        volume={volume}
        isMuted={isMuted}
        onTogglePlay={togglePlay}
        onSeek={(s) => seekTo(s)}
        onVolumeChange={setVolume}
        onToggleMute={toggleMute}
        onToggleFullscreen={handleToggleFullscreen}
        className={showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"}
      />
    </div>
  );
}
