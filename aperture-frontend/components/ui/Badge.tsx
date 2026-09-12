import React from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "primary" | "success" | "warning" | "error";
  size?: "sm" | "md";
}

/** Small tonal label. Colour comes from the container token, never a border. */
export function Badge({ className, tone = "neutral", size = "md", children, ...props }: BadgeProps) {
  const tones: Record<NonNullable<BadgeProps["tone"]>, string> = {
    neutral: "bg-surface-high text-on-variant",
    primary: "bg-primary-container text-primary-on-container",
    success: "bg-success-container text-success",
    warning: "bg-warning-container text-warning",
    error: "bg-error-container text-error",
  };
  const sizes = {
    sm: "h-6 px-2 text-xs gap-1",
    md: "h-7 px-2.5 text-[13px] gap-1.5",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap select-none",
        tones[tone],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
