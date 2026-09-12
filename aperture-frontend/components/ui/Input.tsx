import React from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  label?: string;
}

/** Material outlined text field. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", icon, label, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <label className="block w-full" htmlFor={inputId}>
        {label && (
          <span className="mb-1.5 block text-[13px] font-medium text-on-variant">{label}</span>
        )}
        <span className="relative flex items-center">
          {icon && (
            <span className="pointer-events-none absolute left-3.5 flex items-center text-on-muted">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              "h-12 w-full rounded-lg border border-outline bg-surface px-4 text-sm text-on-surface",
              "placeholder:text-on-muted transition-[border-color,box-shadow] duration-150",
              "hover:border-on-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
              icon && "pl-11",
              className
            )}
            {...props}
          />
        </span>
      </label>
    );
  }
);

Input.displayName = "Input";
