"use client";

import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Video } from "@/types/video";

export interface DeleteVideoDialogProps {
  video: Video | null;
  onClose: () => void;
  onConfirm: (video: Video) => Promise<void>;
}

/** Material confirmation dialog for a destructive action. */
export function DeleteVideoDialog({ video, onClose, onConfirm }: DeleteVideoDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (!video) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(video);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={video !== null} onClose={busy ? () => {} : onClose} title="Delete this video?" className="max-w-sm">
      {video && (
        <div className="space-y-5">
          <p className="text-sm text-on-variant">
            <span className="font-medium text-on-surface">{video.title}</span> will be removed from your library along
            with its transcript and search index. This can&apos;t be undone.
          </p>
          {error && (
            <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="text" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
