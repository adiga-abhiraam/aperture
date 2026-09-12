import React from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { VideoProcessingDetails } from "@/types/video";
import { getStatusConfig } from "../utils/statusHelpers";
import { cn } from "@/lib/cn";

export interface ProcessingTimelineProps {
  details: VideoProcessingDetails;
  className?: string;
}

/** Vertical stepper (Material "stepper" pattern) for the ingestion stages. */
export function ProcessingTimeline({ details, className }: ProcessingTimelineProps) {
  const config = getStatusConfig(details.status);
  const barColor =
    details.status === "failed" ? "bg-error" : details.status === "preprocessed" ? "bg-success" : "bg-primary";

  return (
    <div className={cn("space-y-5", className)}>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-on-surface">{config.label}</span>
          <span className="text-sm tabular-nums text-on-muted">{details.progressPercent}%</span>
        </div>
        <p className="mt-0.5 text-[13px] text-on-muted">{config.description}</p>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-surface-high">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", barColor)}
            style={{ width: `${details.progressPercent}%` }}
          />
        </div>
      </div>

      {details.error && (
        <div className="flex items-start gap-3 rounded-xl bg-error-container px-4 py-3 text-[13px] text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{details.error}</span>
        </div>
      )}

      <ol className="relative ml-3 border-l border-outline-variant">
        {details.steps.map((step, idx) => {
          const done = step.status === "completed";
          const active = step.status === "in_progress";
          const failed = step.status === "failed";
          return (
            <li key={idx} className="relative pb-5 pl-7 last:pb-0">
              <span
                className={cn(
                  "absolute -left-3 top-0 flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  done && "bg-success text-white",
                  active && "bg-primary text-primary-on",
                  failed && "bg-error text-white",
                  !done && !active && !failed && "bg-surface-high text-on-muted"
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : failed ? (
                  <AlertCircle className="h-3.5 w-3.5" />
                ) : (
                  idx + 1
                )}
              </span>
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    "text-sm",
                    active ? "font-medium text-on-surface" : done ? "text-on-surface" : "text-on-muted"
                  )}
                >
                  {step.name}
                </span>
                {step.duration && <span className="text-xs tabular-nums text-on-muted">{step.duration}</span>}
              </div>
              <p className="mt-0.5 text-[13px] text-on-muted">{step.description}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
