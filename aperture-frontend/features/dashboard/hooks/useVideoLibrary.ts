"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Video } from "@/types/video";
import { videoService, UploadOptions } from "@/services/videoService";
import { ApiError } from "@/services/api/client";

const POLL_WHILE_PROCESSING_MS = 2500;

/**
 * The whole library, kept fresh: refetches on focus and polls while any
 * video is processing so progress badges move without a reload.
 */
export function useVideoLibrary() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await videoService.list();
      setVideos(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const processing = videos.some((v) => v.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void refresh(), POLL_WHILE_PROCESSING_MS);
    return () => clearInterval(timer);
  }, [processing, refresh]);

  const upload = useCallback(
    async (file: Blob, filename: string, options: UploadOptions) => {
      const video = await videoService.upload(file, filename, options);
      setVideos((prev) => [video, ...prev.filter((v) => v.id !== video.id)]);
      return video;
    },
    []
  );

  const startProcessing = useCallback(async (id: string) => {
    const video = await videoService.startProcessing(id);
    setVideos((prev) => prev.map((v) => (v.id === id ? video : v)));
    return video;
  }, []);

  const remove = useCallback(async (id: string) => {
    await videoService.delete(id);
    setVideos((prev) => prev.filter((v) => v.id !== id));
  }, []);

  return { videos, loading, error, refresh, upload, startProcessing, remove };
}
