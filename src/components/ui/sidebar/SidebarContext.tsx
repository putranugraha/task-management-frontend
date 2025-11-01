"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type SidebarState = {
  collapsed: boolean;
  setCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  openMobile: boolean;
  setOpenMobile: (v: boolean | ((p: boolean) => boolean)) => void;
  toggleCollapsed: () => void;
  open: () => void;
  close: () => void;
};

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openMobile, setOpenMobile] = useState(false);

  // hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("sidebar:collapsed");
      if (raw != null) setCollapsed(raw === "1");
    } catch {
      // ignore
    }
  }, []);

  // persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed((p) => !p), []);
  const open = useCallback(() => setOpenMobile(true), []);
  const close = useCallback(() => setOpenMobile(false), []);

  const value = useMemo(
    () => ({ collapsed, setCollapsed, openMobile, setOpenMobile, toggleCollapsed, open, close }),
    [collapsed, openMobile, toggleCollapsed]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within <SidebarProvider>");
  return ctx;
}

