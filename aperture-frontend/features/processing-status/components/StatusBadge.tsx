import React from "react";
import { CheckCircle2, Loader2, Circle, AlertCircle } from "lucide-react";
import { ProcessingStatus } from "@/types/video";
import { Badge } from "@/components/ui/Badge";
import { getStatusConfig } from "../utils/statusHelpers";
import { cn } from "@/lib/cn";

export interface StatusBadgeProps {
  status: ProcessingStatus;
  progressPercent?: number;
  size?: "sm" | "md";
  showIcon?: boolean;
  /** Solid surface behind the badge, for use over thumbnails. */
  elevated?: boolean;
  className?: string;
}

const ICONS = {
  check: CheckCircle2,
  loader: Loader2,
  circle: Circle,
  alert: AlertCircle,
};

export function StatusBadge({
  status,
  progressPercent,
  size = "md",
  showIcon = true,
  elevated = false,
  className,
}: StatusBadgeProps) {
  const config = getStatusConfig(status);
  const Icon = ICONS[config.iconName];
  const label =
    status === "processing" && progressPercent !== undefined ? `Processing ${progressPercent}%` : config.label;

  return (
    <Badge
      tone={config.tone}
      size={size}
      title={config.description}
      className={cn(elevated && "shadow-e1 ring-1 ring-black/5", className)}
    >
      {showIcon && <Icon className={cn("h-3.5 w-3.5", config.iconName === "loader" && "animate-spin")} />}
      {label}
    </Badge>
  );
}
