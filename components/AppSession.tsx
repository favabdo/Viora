"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

export type AppSessionValue = {
  session: Session;
  userName: string;
  avatarUrl: string | null;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

export function AppSessionProvider({ value, children }: { value: AppSessionValue; children: ReactNode }) {
  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>;
}

export function useAppSession() {
  const ctx = useContext(AppSessionContext);
  if (!ctx) throw new Error("useAppSession لازم يتستخدم جوه AppSessionProvider");
  return ctx;
}
