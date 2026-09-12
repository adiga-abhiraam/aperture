import React from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

/** Product mark: a simple aperture glyph in the accent colour + wordmark. */
export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      className={cn("flex items-center gap-2 select-none rounded-full", className)}
      aria-label="Aperture home"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="14" cy="14" r="12" className="stroke-primary" strokeWidth="2.5" />
        <path
          d="M14 2v12l10.4 6M14 14L3.6 20M14 14l10.4-6M14 14v12M14 14L3.6 8"
          className="stroke-primary"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <span className="text-[22px] font-normal tracking-tight text-on-variant">Aperture</span>
      )}
    </Link>
  );
}
