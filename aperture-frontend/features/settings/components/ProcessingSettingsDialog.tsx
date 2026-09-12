"use client";

import React, { useEffect, useState } from "react";
import { Cpu, Cloud, Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { ProcessingMode, useProcessingSettings } from "../context/ProcessingSettingsContext";

const OPTIONS: { value: ProcessingMode; icon: React.ElementType; title: string; body: string }[] = [
  {
    value: "local",
    icon: Cpu,
    title: "Self-Hosted Local Engine",
    body: "Whisper (Speech ASR), X-CLIP (Visual Embeddings), CLAP (Audio Events), BGE-M3 (Text Vectors), and Qwen-VL (Scene Captioning) execute locally with Qdrant vector storage.",
  },
];

export function ProcessingSettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const settings = useProcessingSettings();
  const [mode, setMode] = useState<ProcessingMode>("local");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode("local");
    }
  }, [isOpen]);

  const save = async () => {
    setBusy(true);
    try {
      settings.setMode("local");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Processing Engine" description="System execution pipeline configuration." className="max-w-lg">
      <div className="space-y-5">
        <div role="radiogroup" className="space-y-2">
          {OPTIONS.map(({ value, icon: Icon, title, body }) => (
            <div
              key={value}
              className="flex w-full items-start gap-4 rounded-2xl border border-primary bg-primary-container/40 p-4 text-left"
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-on">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  {title}
                  <span className="rounded-full bg-success/20 px-2 py-px text-[11px] font-medium text-success">Active</span>
                </span>
                <span className="mt-0.5 block text-[13px] text-on-muted">{body}</span>
              </span>
              <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="filled" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
