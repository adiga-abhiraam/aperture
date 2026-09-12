"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
}

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<boolean>;
  register: (name: string, email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "aperture_user_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check saved session in localStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load auth session", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password?: string) => {
    setIsLoading(true);
    // Simulate brief network auth
    await new Promise((res) => setTimeout(res, 350));

    const name = email.split("@")[0].replace(/[._]/g, " ");
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
    const initials = formattedName.slice(0, 2).toUpperCase() || "AP";

    const authenticatedUser: User = {
      id: `usr-${Date.now()}`,
      name: formattedName,
      email,
      avatarInitials: initials,
    };

    setUser(authenticatedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authenticatedUser));
    setIsLoading(false);
    return true;
  }, []);

  const register = useCallback(async (name: string, email: string, password?: string) => {
    setIsLoading(true);
    await new Promise((res) => setTimeout(res, 400));

    const initials = name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AP";

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name,
      email,
      avatarInitials: initials,
    };

    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    setIsLoading(false);
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
