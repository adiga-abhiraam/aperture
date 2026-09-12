"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Navbar } from "./Navbar";
import { Sidebar, SidebarProps } from "./Sidebar";
import { useAuth } from "@/features/auth";
import { useUpload } from "@/features/upload";
import { cn } from "@/lib/cn";

export interface AppShellProps {
  children: React.ReactNode;
  /** Defaults to open on the dashboard, collapsed on the watch page. */
  defaultSidebarOpen?: boolean;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  selectedStatus?: SidebarProps["selectedStatus"];
  onSelectStatus?: SidebarProps["onSelectStatus"];
  counts?: SidebarProps["counts"];
  /** Extra classes for the main column (e.g. a right margin for a fixed panel). */
  contentClassName?: string;
}

/**
 * Shared page chrome: auth guard, app bar, nav rail, and the responsive
 * main column. Pages only render their content.
 *
 * Upload works from every page: the picked file is staged in UploadContext
 * and the dashboard finishes the flow.
 */
export function AppShell({
  children,
  defaultSidebarOpen = true,
  searchQuery,
  onSearchChange,
  selectedStatus,
  onSelectStatus,
  counts,
  contentClassName,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const { stage } = useUpload();
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On phones the rail is a drawer, so it must start closed regardless of the
  // page default. Done in an effect to keep server and client markup identical.
  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-surface-high border-t-primary" />
      </div>
    );
  }

  const openPicker = () => fileInputRef.current?.click();

  return (
    <div className="min-h-screen">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        data-testid="upload-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          stage(f);
          if (!pathname.startsWith("/dashboard")) router.push("/dashboard");
        }}
      />

      <Navbar
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        onUploadClick={openPicker}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      <Sidebar
        isOpen={sidebarOpen}
        selectedStatus={selectedStatus}
        onSelectStatus={onSelectStatus}
        onUploadClick={openPicker}
        counts={counts}
      />

      {/* Mobile scrim */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 top-16 z-20 bg-black/30 md:hidden animate-fade-in"
        />
      )}

      <main className={cn("transition-[margin] duration-300 ease-out", sidebarOpen ? "md:ml-64" : "md:ml-[72px]")}>
        <div className={cn("px-4 pt-2 sm:px-6", contentClassName)}>{children}</div>
      </main>
    </div>
  );
}
