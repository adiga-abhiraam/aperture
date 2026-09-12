"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";

export interface SeekNotification {
  timestamp: number;
  label: string;
  description?: string;
  id: number;
}

export interface VideoPlayerContextType {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  seekNotification: SeekNotification | null;
  seekTo: (seconds: number, description?: string) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setCurrentTime: (t: number) => void;
  setDuration: (d: number) => void;
  setIsPlaying: (p: boolean) => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextType | null>(null);

export function VideoPlayerProvider({ children }: { children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [seekNotification, setSeekNotification] = useState<SeekNotification | null>(null);

  const seekTo = useCallback((seconds: number, description?: string) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
    setCurrentTime(seconds);

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const label = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;

    setSeekNotification({
      timestamp: seconds,
      label,
      description,
      id: Date.now(),
    });

    // Auto-clear notification after 2.5s
    setTimeout(() => {
      setSeekNotification((prev) => (prev?.timestamp === seconds ? null : prev));
    }, 2500);
  }, []);

  const play = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
    setVolumeState(v);
    setIsMuted(v === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  }, []);

  return (
    <VideoPlayerContext.Provider
      value={{
        videoRef,
        currentTime,
        duration,
        isPlaying,
        volume,
        isMuted,
        seekNotification,
        seekTo,
        play,
        pause,
        togglePlay,
        setVolume,
        toggleMute,
        setCurrentTime,
        setDuration,
        setIsPlaying,
      }}
    >
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayerContext() {
  const ctx = useContext(VideoPlayerContext);
  if (!ctx) {
    throw new Error("useVideoPlayerContext must be used within VideoPlayerProvider");
  }
  return ctx;
}
