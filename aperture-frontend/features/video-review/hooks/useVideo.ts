"use client";

import { useCallback, useEffect, useState } from "react";
import { Video } from "@/types/video";
import { videoService } from "@/services/videoService";

const POLL_WHILE_PROCESSING_MS = 2000;

/** One video for the watch page, polled while it is being processed. */
export function useVideo(id: string) {
  const [video, setVideo] = useState<Video | null | undefined>(undefined); // undefined = loading
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVideo(await videoService.get(id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setVideo((current) => current ?? null);
    }
  }, [id]);

  useEffect(() => {
    setVideo(undefined);
    void refresh();
  }, [refresh]);

  const processing = video?.status === "processing";
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void refresh(), POLL_WHILE_PROCESSING_MS);
    return () => clearInterval(timer);
  }, [processing, refresh]);

  const startProcessing = useCallback(async () => {
    try {
      const next = await videoService.startProcessing(id);
      setVideo(next);
      setError(null);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    }
  }, [id]);

  return { video, error, refresh, startProcessing };
}
