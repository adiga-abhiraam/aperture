"use client";

import React, { useState } from "react";
import { Video } from "@/types/video";
import { cn } from "@/lib/cn";

/** YouTube-style expandable description card with a tidy metadata table. */
export function VideoDetailsBox({ video }: { video: Video }) {
  const [expanded, setExpanded] = useState(false);
  const m = video.metadata;

  const rows: [string, string][] = [
    ["Resolution", `${m.resolution} · ${m.fps} fps`],
    ["File", `${m.format} · ${m.fileSize}`],
    ["Speech model", m.embeddingModels.audio],
    ["Visual model", m.embeddingModels.visual],
    ["Text model", m.embeddingModels.text],
    ["Indexed segments", video.status === "preprocessed" ? String(m.vectorCount) : "—"],
  ];

  return (
    <section
      className={cn(
        "rounded-xl bg-surface-container px-4 py-3 text-sm transition-colors",
        !expanded && "cursor-pointer hover:bg-surface-high"
      )}
      onClick={() => !expanded && setExpanded(true)}
    >
      <p className={cn("whitespace-pre-line text-on-surface", !expanded && "line-clamp-2")}>{video.description}</p>

      {expanded && (
        <div className="mt-4 space-y-4 animate-fade-in">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-outline-variant py-1.5 text-[13px]">
                <dt className="text-on-muted">{label}</dt>
                <dd className="truncate text-right text-on-surface" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {video.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {video.tags.map((tag) => (
                <span key={tag} className="rounded-lg bg-surface px-2.5 py-1 text-xs text-on-variant">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="mt-2 text-[13px] font-medium text-on-surface hover:underline"
      >
        {expanded ? "Show less" : "...more"}
      </button>
    </section>
  );
}
