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
    title: "This computer",
    body: "Whisper, X-CLIP, CLAP and BGE-M3 run on your CPU. Nothing leaves your machine. Slower, free.",
  },
  {
    value: "api",
    icon: Cloud,
    title: "Cloud API (Gemini)",
    body: "Video is sent to Google's Gemini API for transcription, embeddings and captions. Fast on a laptop; needs an API key.",
  },
];

export function ProcessingSettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const settings = useProcessingSettings();
  const [mode, setMode] = useState<ProcessingMode>(settings.mode);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(settings.mode);
      setKey("");
      setError(null);
    }
  }, [isOpen, settings.mode]);

  const save = async () => {
    setError(null);
    if (mode === "api" && !settings.hasApiKey && !key.trim()) {
      setError("Enter a Gemini API key to use the cloud option.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "api" && key.trim()) await settings.saveApiKey(key);
      settings.setMode(mode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Processing" description="Choose where new videos are processed." className="max-w-lg">
      <div className="space-y-5">
        <div role="radiogroup" className="space-y-2">
          {OPTIONS.map(({ value, icon: Icon, title, body }) => {
            const selected = mode === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(value)}
                className={cn(
                  "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors",
                  selected ? "border-primary bg-primary-container/40" : "border-outline hover:bg-surface-container"
                )}
              >
                <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full", selected ? "bg-primary text-primary-on" : "bg-surface-container text-on-variant")}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium text-on-surface">
                    {title}
                    {value === "local" && <span className="rounded-full bg-surface-high px-2 py-px text-[11px] font-normal text-on-variant">Default</span>}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-on-muted">{body}</span>
                </span>
                {selected && <Check className="mt-1 h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

        {mode === "api" && (
          <div className="space-y-3 rounded-2xl bg-surface-container p-4 animate-fade-in">
            {settings.hasApiKey ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-on-surface">
                  <Check className="h-4 w-4 text-success" />
                  Gemini key saved for this session
                </span>
                <Button variant="text" size="sm" onClick={settings.clearApiKey}>
                  Remove
                </Button>
              </div>
            ) : (
              <Input
                label="Gemini API key"
                name="gemini_key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIza…"
                autoComplete="off"
              />
            )}
            <p className="text-xs text-on-muted">
              The key is kept in memory for this browser tab only and is never written to disk. Videos processed this way are
              uploaded to Google.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-error-container px-3 py-2 text-[13px] text-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="text" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="filled" onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
