"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Logo } from "@/components/shared/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/** Google-sign-in style card: brand, one headline, two fields, two actions. */
export function AuthCard() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) return setError("Enter your email and password.");
    if (mode === "register" && !name.trim()) return setError("Enter your name.");
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(name.trim(), email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const demo = async () => {
    setBusy(true);
    await login("demo.researcher@aperture.ai", "demo123");
    router.replace("/dashboard");
  };

  return (
    <div className="w-full max-w-[448px] rounded-[28px] bg-surface px-8 py-10 shadow-e1 sm:px-10">
      <Logo compact />
      <h1 className="mt-6 text-2xl font-normal text-on-surface">
        {mode === "login" ? "Sign in" : "Create your account"}
      </h1>
      <p className="mt-2 text-base text-on-variant">
        {mode === "login" ? "to continue to Aperture" : "to start searching your videos"}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        {mode === "register" && (
          <Input label="Name" name="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        )}
        <Input
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
        />
        <Input
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {error && (
          <p role="alert" className="text-[13px] text-error">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="text"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create account" : "Sign in instead"}
          </Button>
          <Button type="submit" variant="filled" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Next" : "Create"}
          </Button>
        </div>
      </form>

      <div className="mt-8 border-t border-outline-variant pt-6">
        <Button type="button" variant="outlined" onClick={demo} disabled={busy} className="w-full">
          Continue with a demo account
        </Button>
      </div>
    </div>
  );
}
