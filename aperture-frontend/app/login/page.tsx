"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, AuthCard } from "@/features/auth";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) router.replace("/dashboard");
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-surface-high border-t-primary" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <AuthCard />
      <footer className="mt-8 flex gap-6 text-xs text-on-muted">
        <span>Aperture</span>
        <span>Privacy</span>
        <span>Terms</span>
      </footer>
    </main>
  );
}
