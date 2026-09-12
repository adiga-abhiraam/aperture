"use client";

import React, { useEffect, useState } from "react";
import { Film, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PendingUpload } from "@/features/upload";
import { formatDuration } from "@/lib/formatters";

export interface UploadModalProps {
  pending: PendingUpload | null;
  onClose: () => void;
  onConfirmUpload: (data: { title: string; startProcessing: boolean }) => Promise<void> | void;
}

export function UploadModal({ pending, onClose, onConfirmUpload }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [startProcessing, setStartProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const isOpen = pending !== null;

  useEffect(() => {
    if (!pending) return;
    const cleaned = pending.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    setTitle(cleaned || "My video");
    setStartProcessing(false);
  }, [pending?.name, pending?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending || !title.trim() || busy) return;
    setBusy(true);
    try {
      await onConfirmUpload({ title: title.trim(), startProcessing });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to your library" className="max-w-md">
      {pending && (
        <form onSubmit={submit} className="space-y-5">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
            {pending.thumbnailUrl ? (
              <img src={pending.thumbnailUrl} alt="" className="h-full w-full object-contain animate-fade-in" />
            ) : (
              <video src={pending.url} className="h-full w-full object-contain" muted playsInline preload="metadata" />
            )}
            {pending.duration !== undefined && (
              <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
                {formatDuration(pending.duration)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-surface-container px-4 py-3 text-[13px]">
            <Film className="h-5 w-5 shrink-0 text-on-muted" />
            <span className="min-w-0 flex-1 truncate text-on-surface">{pending.name}</span>
            {pending.size && <span className="shrink-0 text-on-muted">{pending.size}</span>}
          </div>

          <Input label="Title" name="title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required />

          <label className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-1">
            <input
              type="checkbox"
              checked={startProcessing}
              onChange={(e) => setStartProcessing(e.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[rgb(var(--c-primary))]"
            />
            <span>
              <span className="block text-sm text-on-surface">Process now</span>
              <span className="block text-[13px] text-on-muted">
                Transcribe speech and index visuals so you can search and ask questions. You can also do this later.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="text" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant="filled" disabled={!title.trim() || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Uploading" : startProcessing ? "Add and process" : "Add"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
