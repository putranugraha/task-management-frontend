"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { listMyNotifications } from "@/lib/api/notifications";
import { useAuth } from "@/contexts/auth-context";

type NotificationContextValue = {
  unreadCount: number | null;
  refreshUnreadCount: () => Promise<void>;
  decrementUnreadCount: () => void;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined
);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  const isAuthenticated = !!state?.user && !!state?.token;

  const refreshUnreadCount = useCallback(async () => {
    if (!state?.isInitialized || !isAuthenticated) return;

    try {
      console.log("[NOTIF] provider refresh", new Date().toLocaleTimeString());
      console.log("[NOTIF] page load", new Date().toLocaleTimeString());
      const res = await listMyNotifications({
        only_unread: true,
        page: 1,
        per_page: 1,
      });
      setUnreadCount(res.meta?.total ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [state?.isInitialized, isAuthenticated]);

  const decrementUnreadCount = useCallback(() => {
    setUnreadCount((prev) => {
      if (typeof prev !== "number") return prev;
      return Math.max(0, prev - 1);
    });
  }, []);

  const value: NotificationContextValue = useMemo(
    () => ({
      unreadCount,
      refreshUnreadCount,
      decrementUnreadCount,
    }),
    [unreadCount, refreshUnreadCount, decrementUnreadCount]
  );

  useEffect(() => {
    if (!state?.isInitialized) return;

    if (!isAuthenticated) {
      setUnreadCount(null);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const run = () => {
      refreshUnreadCount().catch(() => {});
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      timeoutId = setTimeout(run, 300);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (idleId !== null && typeof window !== "undefined" && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
    };
  }, [state?.isInitialized, refreshUnreadCount, isAuthenticated]);

  useEffect(() => {
    if (!state?.isInitialized || !isAuthenticated) return;
    if (typeof window === "undefined") return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshUnreadCount().catch(() => {});
      }
    }, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshUnreadCount().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [state?.isInitialized, isAuthenticated, refreshUnreadCount]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return ctx;
}
