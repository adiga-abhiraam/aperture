import React from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Material 3 button roles:
   *  filled  – the single high-emphasis action on a screen
   *  tonal   – medium emphasis, sits on the primary container colour
   *  outlined– medium emphasis with a hairline
   *  text    – low emphasis, no container
   *  icon    – 40px circular icon button
   */
  variant?: "filled" | "tonal" | "outlined" | "text" | "icon" | "danger";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "outlined", size = "md", children, ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none " +
      "transition-[background-color,box-shadow,color] duration-150 cursor-pointer " +
      "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";

    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      filled: "bg-primary text-primary-on hover:bg-primary-hover hover:shadow-e1",
      tonal:
        "bg-primary-container text-primary-on-container hover:shadow-e1 hover:brightness-95 dark:hover:brightness-110",
      outlined:
        "border border-outline text-primary bg-transparent hover:bg-primary/[.08] active:bg-primary/[.12]",
      text: "text-primary bg-transparent hover:bg-primary/[.08] active:bg-primary/[.12]",
      icon: "text-on-variant bg-transparent state-layer",
      danger: "bg-error-container text-error hover:shadow-e1",
    };

    const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "h-8 px-4 text-[13px]",
      md: "h-10 px-6 text-sm",
      lg: "h-12 px-7 text-[15px]",
    };

    const iconSizes: Record<NonNullable<ButtonProps["size"]>, string> = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12",
    };

    return (
      <button
        ref={ref}
        className={cn(
          base,
          variants[variant],
          variant === "icon" ? iconSizes[size] + " p-0" : sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
