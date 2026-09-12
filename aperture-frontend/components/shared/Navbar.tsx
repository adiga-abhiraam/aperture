"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Menu, LogOut, Upload, Sun, Moon, Monitor, Check, Cpu, Cloud } from "lucide-react";
import { ProcessingSettingsDialog, useProcessingSettings } from "@/features/settings";
import { Logo } from "./Logo";
import { Button } from "../ui/Button";
import { useAuth } from "@/features/auth";
import { useTheme, ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/cn";

export interface NavbarProps {
  onToggleSidebar?: () => void;
  onUploadClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Device default", icon: Monitor },
];

export function Navbar({ onToggleSidebar, onUploadClick, searchQuery = "", onSearchChange }: NavbarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const [query, setQuery] = useState(searchQuery);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { mode } = useProcessingSettings();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(searchQuery), [searchQuery]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearchChange) onSearchChange(query);
    else router.push(`/dashboard?q=${encodeURIComponent(query)}`);
  };

  const change = (value: string) => {
    setQuery(value);
    onSearchChange?.(value);
  };

  const firstName = user?.name.split(" ")[0];

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 bg-bg px-4">
      {/* Left: menu + brand. The menu button is centred at x=36 to line up with the rail. */}
      <div className="flex w-auto items-center md:w-60">
        <Button variant="icon" onClick={onToggleSidebar} aria-label="Main menu">
          <Menu className="h-6 w-6" />
        </Button>
        <Logo className="ml-4 hidden sm:flex" />
        <Logo compact className="ml-4 sm:hidden" />
      </div>

      {/* Center: search */}
      <form onSubmit={submit} className="flex min-w-0 flex-1 justify-center px-2">
        <div
          className={cn(
            "flex h-12 w-full max-w-[720px] items-center rounded-full bg-surface-container pl-2 pr-1",
            "transition-[background-color,box-shadow] duration-150",
            "focus-within:bg-surface focus-within:shadow-e1"
          )}
        >
          <Button type="submit" variant="icon" aria-label="Search" className="shrink-0">
            <Search className="h-5 w-5" />
          </Button>
          <input
            type="search"
            value={query}
            onChange={(e) => change(e.target.value)}
            placeholder="Search your videos"
            className="h-full min-w-0 flex-1 bg-transparent px-2 text-base text-on-surface placeholder:text-on-muted focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <Button type="button" variant="icon" aria-label="Clear search" onClick={() => change("")}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </form>

      {/* Right: upload + account */}
      <div className="flex items-center gap-1">
        {onUploadClick && (
          <>
            <Button variant="icon" onClick={onUploadClick} aria-label="Upload video" className="md:hidden">
              <Upload className="h-5 w-5" />
            </Button>
            <Button variant="text" size="sm" onClick={onUploadClick} className="hidden md:inline-flex">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </>
        )}

        <div className="relative ml-1" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full state-layer"
            aria-label="Account"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-medium text-primary-on">
              {user?.avatarInitials || "AP"}
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-72 origin-top-right overflow-hidden rounded-[20px] bg-surface-low shadow-e3 animate-scale-in"
            >
              <div className="flex flex-col items-center px-4 pb-4 pt-5 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-medium text-primary-on">
                  {user?.avatarInitials || "AP"}
                </span>
                <div className="mt-3 text-base text-on-surface">{firstName ? `Hi, ${firstName}!` : "Guest"}</div>
                {user && <div className="text-[13px] text-on-muted">{user.email}</div>}
              </div>

              <div className="mx-2 rounded-2xl bg-surface p-1">
                <div className="px-3 pb-1 pt-2 text-xs font-medium text-on-muted">Appearance</div>
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={preference === value}
                    onClick={() => setPreference(value)}
                    className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-on-surface state-layer"
                  >
                    <Icon className="h-5 w-5 text-on-variant" />
                    <span className="flex-1 text-left">{label}</span>
                    {preference === value && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>

              <div className="mx-2 mt-1 rounded-2xl bg-surface p-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setSettingsOpen(true);
                  }}
                  className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-on-surface state-layer"
                >
                  {mode === "api" ? <Cloud className="h-5 w-5 text-on-variant" /> : <Cpu className="h-5 w-5 text-on-variant" />}
                  <span className="flex-1 text-left">Processing</span>
                  <span className="text-xs text-on-muted">{mode === "api" ? "Cloud API" : "This computer"}</span>
                </button>
              </div>

              <div className="m-2 mt-1 rounded-2xl bg-surface p-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    logout();
                    router.push("/login");
                  }}
                  className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-on-surface state-layer"
                >
                  <LogOut className="h-5 w-5 text-on-variant" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ProcessingSettingsDialog isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
