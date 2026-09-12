"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { captureVideoFrame, readVideoDuration } from "@/lib/thumbnail";

export interface PendingUpload {
  /** The picked file (absent for bundled samples, which are fetched by URL). */
  file?: File;
  name: string;
  /** Object URL for a picked file, or a path for a bundled sample. */
  url: string;
  size?: string;
  /** JPEG data URL of the first frame, filled in asynchronously. */
  thumbnailUrl?: string;
  duration?: number;
}

interface UploadContextValue {
  pending: PendingUpload | null;
  /** Accepts a picked File or a sample descriptor; probes it for a poster and duration. */
  stage: (input: File | { name: string; url: string; size?: string }) => void;
  clear: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

/**
 * Holds the file the user just picked so any page (watch page, nav rail,
 * app bar) can start an upload and the dashboard can finish it.
 */
export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingUpload | null>(null);

  const stage = useCallback((input: File | { name: string; url: string; size?: string }) => {
    const base: PendingUpload =
      input instanceof File
        ? { file: input, name: input.name, url: URL.createObjectURL(input), size: `${(input.size / (1024 * 1024)).toFixed(1)} MB` }
        : { name: input.name, url: input.url, size: input.size };
    setPending(base);

    // Probe in the background; the modal updates when these resolve.
    Promise.all([captureVideoFrame(base.url), readVideoDuration(base.url)]).then(([thumbnailUrl, duration]) => {
      setPending((current) =>
        current && current.url === base.url
          ? { ...current, thumbnailUrl: thumbnailUrl ?? current.thumbnailUrl, duration: duration ?? current.duration }
          : current
      );
    });
  }, []);

  const clear = useCallback(() => setPending(null), []);

  const value = useMemo(() => ({ pending, stage, clear }), [pending, stage, clear]);
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within an UploadProvider");
  return ctx;
}
