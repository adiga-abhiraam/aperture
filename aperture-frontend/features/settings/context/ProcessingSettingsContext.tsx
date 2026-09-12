"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/services/api/client";

/**
 * Where processing happens.
 *  local — Whisper, X-CLIP, CLAP and BGE-M3 on this machine's CPU. Default.
 *  api   — Gemini for transcription/embeddings/captions; video leaves the machine.
 */
export type ProcessingMode = "local" | "api";

export const LOCAL_PROFILE_ID = "self-hosted-v1";
export const API_PROFILE_ID = "api-gemini-free-v1";

const MODE_KEY = "aperture_processing_mode";
// The key and session live only for this browser tab: the backend session is
// in-memory too, so nothing outlives a restart on either side.
const KEY_KEY = "aperture_gemini_key";
const SESSION_KEY = "aperture_runtime_session";

interface ProcessingSettings {
  mode: ProcessingMode;
  setMode: (mode: ProcessingMode) => void;
  hasApiKey: boolean;
  /** Validates the key by creating a backend runtime session. */
  saveApiKey: (key: string) => Promise<void>;
  clearApiKey: () => void;
  /**
   * Runtime session id for API-mode requests, re-created if the backend has
   * forgotten it. Throws when no key is configured.
   */
  ensureSession: () => Promise<string>;
}

const Ctx = createContext<ProcessingSettings | null>(null);

const read = (store: Storage, key: string) => {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
};
const write = (store: Storage, key: string, value: string | null) => {
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

async function createSession(key: string): Promise<string> {
  const res = await api<{ session_id: string }>("/api/runtime/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_id: API_PROFILE_ID,
      gemini_api_key: key,
      // Reuse the local Qdrant container; the API profile writes to its own collection.
      vector_store_target: "local",
      qdrant_url: "http://localhost:6333",
      consent_cloud_video: true,
    }),
  });
  return res.session_id;
}

export function ProcessingSettingsProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ProcessingMode>("local");
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    const saved = read(localStorage, MODE_KEY);
    if (saved === "api" || saved === "local") setModeState(saved);
    setHasApiKey(Boolean(read(sessionStorage, KEY_KEY)));
  }, []);

  const setMode = useCallback((next: ProcessingMode) => {
    setModeState(next);
    write(localStorage, MODE_KEY, next);
  }, []);

  const saveApiKey = useCallback(async (key: string) => {
    const sessionId = await createSession(key.trim());
    write(sessionStorage, KEY_KEY, key.trim());
    write(sessionStorage, SESSION_KEY, sessionId);
    setHasApiKey(true);
  }, []);

  const clearApiKey = useCallback(() => {
    write(sessionStorage, KEY_KEY, null);
    write(sessionStorage, SESSION_KEY, null);
    setHasApiKey(false);
  }, []);

  const ensureSession = useCallback(async () => {
    const key = read(sessionStorage, KEY_KEY);
    if (!key) throw new Error("Add your Gemini API key in Processing settings first.");
    const existing = read(sessionStorage, SESSION_KEY);
    if (existing) {
      try {
        await api(`/api/runtime/session/${encodeURIComponent(existing)}`);
        return existing;
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) throw err;
      }
    }
    const fresh = await createSession(key);
    write(sessionStorage, SESSION_KEY, fresh);
    return fresh;
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, hasApiKey, saveApiKey, clearApiKey, ensureSession }),
    [mode, setMode, hasApiKey, saveApiKey, clearApiKey, ensureSession]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProcessingSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProcessingSettings must be used within ProcessingSettingsProvider");
  return ctx;
}
