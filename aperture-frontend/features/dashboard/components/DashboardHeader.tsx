"use client";

import React from "react";
import { LayoutGrid, List, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SortKey = "newest" | "oldest" | "duration" | "title";

export interface DashboardHeaderProps {
  title: string;
  totalCount: number;
  layout: "grid" | "list";
  onToggleLayout: (layout: "grid" | "list") => void;
  sortBy: SortKey;
  onSortChange: (sort: SortKey) => void;
}

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest",
  oldest: "Oldest",
  duration: "Longest",
  title: "Title",
};

export function DashboardHeader({ title, totalCount, layout, onToggleLayout, sortBy, onSortChange }: DashboardHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[22px] font-normal leading-7 text-on-surface">{title}</h1>
        <span className="text-sm text-on-muted">
          {totalCount} {totalCount === 1 ? "video" : "videos"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label className="relative flex h-9 items-center rounded-full bg-surface-container pl-4 pr-9 text-[13px] text-on-surface transition-colors hover:bg-surface-high">
          <span className="text-on-muted">Sort:&nbsp;</span>
          {SORT_LABELS[sortBy]}
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Sort videos"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-on-muted" />
        </label>

        <div className="flex h-9 items-center rounded-full border border-outline p-0.5" role="group" aria-label="Layout">
          {(
            [
              ["grid", LayoutGrid, "Grid view"],
              ["list", List, "List view"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              aria-pressed={layout === value}
              onClick={() => onToggleLayout(value)}
              className={cn(
                "flex h-full w-9 items-center justify-center rounded-full transition-colors",
                layout === value ? "bg-primary-container text-primary-on-container" : "text-on-variant hover:bg-surface-high"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
