"use client";

import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useUpload } from "@/features/upload";
import { cn } from "@/lib/cn";

/** First-run state: a large drop zone with a sample-video shortcut. */
export function EmptyState() {
  const { stage } = useUpload();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center px-4 py-10 sm:py-16 animate-fade-in">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) stage(f);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) stage(f);
        }}
        className={cn(
          "flex w-full max-w-2xl flex-col items-center rounded-[28px] border-2 border-dashed px-6 py-14 text-center transition-[border-color,background-color,transform] duration-200",
          dragging ? "scale-[1.01] border-primary bg-primary-container/40" : "border-outline bg-surface"
        )}
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-container text-primary-on-container">
          <Upload className="h-9 w-9" />
        </div>
        <h2 className="mt-6 text-[22px] font-normal text-on-surface sm:text-2xl">Add your first video</h2>
        <p className="mt-2 max-w-md text-sm text-on-muted">
          Drag a file here or choose one from your device. Nothing is processed until you say so.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="filled" size="lg" onClick={() => inputRef.current?.click()}>
            <Upload className="h-5 w-5" />
            Choose a file
          </Button>
          <Button
            variant="text"
            size="lg"
            onClick={() => stage({ name: "barking_dog_reaction.webm", url: "/media/barking_dog_reaction.webm", size: "7.1 MB" })}
          >
            Use a sample video
          </Button>
        </div>

        <p className="mt-8 text-xs text-on-muted">MP4, WebM, MOV or MKV</p>
      </div>
    </div>
  );
}
