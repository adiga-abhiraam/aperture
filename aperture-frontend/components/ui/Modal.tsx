import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Material dialog: 28px radius, no border, elevation-3 shadow, scrim behind. */
export function Modal({ isOpen, onClose, title, description, children, className }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={cn(
          "flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-surface shadow-e3 animate-scale-in",
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-[22px] font-normal leading-7 text-on-surface">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-on-muted">{description}</p>}
          </div>
          <Button variant="icon" size="sm" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-y-auto px-6 pb-6 pt-2">{children}</div>
      </div>
    </div>
  );
}
