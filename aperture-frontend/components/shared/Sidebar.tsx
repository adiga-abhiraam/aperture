"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Film, CheckCircle2, Loader2, Circle, AlertCircle, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { ProcessingStatus } from "@/types/video";

export interface SidebarProps {
  isOpen: boolean;
  selectedStatus?: ProcessingStatus | "all";
  onSelectStatus?: (status: ProcessingStatus | "all") => void;
  onUploadClick?: () => void;
  counts?: Partial<Record<ProcessingStatus | "all", number>>;
}

const ITEMS: { label: string; status: ProcessingStatus | "all"; icon: React.ElementType }[] = [
  { label: "All videos", status: "all", icon: Film },
  { label: "Ready", status: "preprocessed", icon: CheckCircle2 },
  { label: "Processing", status: "processing", icon: Loader2 },
  { label: "Not processed", status: "not_processed", icon: Circle },
  { label: "Failed", status: "failed", icon: AlertCircle },
];

/**
 * Navigation rail on its own tonal surface so it reads as a distinct panel.
 * Expanded: Drive-style rows. Collapsed (desktop): 64px icon tiles.
 */
export function Sidebar({ isOpen, selectedStatus = "all", onSelectStatus, onUploadClick, counts }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const onDashboard = pathname.startsWith("/dashboard");

  const choose = (status: ProcessingStatus | "all") => {
    if (onDashboard && onSelectStatus) onSelectStatus(status);
    else router.push(status === "all" ? "/dashboard" : `/dashboard?status=${status}`);
  };

  return (
    <aside
      className={cn(
        "fixed bottom-0 left-0 top-16 z-30 flex flex-col overflow-hidden border-r border-outline-variant bg-surface-low",
        "transition-[width,transform] duration-300 ease-[cubic-bezier(.2,0,0,1)]",
        // Collapsed rail is 72px so a 20px icon centred in it sits at x=36,
        // the same axis as the hamburger in the app bar.
        isOpen ? "w-64 translate-x-0 shadow-e2 md:shadow-none" : "w-64 -translate-x-full md:w-[72px] md:translate-x-0"
      )}
      aria-label="Library"
    >
      <div className="px-2 pb-2 pt-3">
        <button
          type="button"
          onClick={onUploadClick}
          className={cn(
            "flex h-14 items-center rounded-2xl bg-primary-container text-primary-on-container shadow-e1",
            "transition-[box-shadow,transform,width] duration-200 hover:shadow-e2 hover:-translate-y-px active:translate-y-0 active:shadow-e1",
            // Collapsed: a 56px square centred in the 88px rail, same axis as the icons below.
            // Expanded: 8px margin + 16px padding + 12px half-icon = 36px centre.
            isOpen ? "w-auto gap-4 pl-4 pr-6" : "mx-auto w-14 justify-center"
          )}
          title="Upload a video"
        >
          <Plus className="h-6 w-6 shrink-0" />
          {isOpen && <span className="whitespace-nowrap text-sm font-medium animate-fade-in">Upload</span>}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden py-1">
        {ITEMS.map(({ label, status, icon: Icon }, index) => {
          const active = onDashboard && selectedStatus === status;
          const count = counts?.[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => choose(status)}
              aria-current={active ? "page" : undefined}
              style={{ animationDelay: `${index * 40}ms` }}
              className={cn(
                "group relative flex items-center text-sm animate-fade-in",
                "transition-[background-color,color,transform] duration-200",
                // Expanded: 8px margin + 18px padding + 10px half-icon = 36px centre.
                // Collapsed: 64px tile centred in the 72px rail.
                isOpen
                  ? "mx-2 h-11 w-[calc(100%-16px)] rounded-full pl-[18px] pr-4"
                  : "mx-2 h-11 w-[calc(100%-16px)] rounded-full pl-[18px] pr-4 md:mx-auto md:my-1 md:h-[60px] md:w-16 md:flex-col md:justify-center md:gap-1 md:rounded-2xl md:px-0",
                active
                  ? "bg-primary-container font-medium text-primary-on-container"
                  : "text-on-variant hover:bg-surface-high hover:text-on-surface active:scale-[.98]"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform duration-200",
                  !active && "group-hover:scale-110",
                  active && status === "processing" && "animate-spin"
                )}
              />
              <span
                className={cn(
                  "ml-[18px] flex-1 truncate text-left transition-opacity duration-200",
                  !isOpen && "md:ml-0 md:flex-none md:overflow-visible md:whitespace-normal md:text-center md:text-[10px] md:leading-[11px]"
                )}
              >
                {label}
              </span>
              {isOpen && count !== undefined && (
                <span className="ml-2 text-xs tabular-nums text-on-muted">{count}</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
