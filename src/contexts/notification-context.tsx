"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  const isAuthenticated = !!state?.user && !!state?.token;

  const refreshUnreadCount = useCallback(async () => {
    if (!state?.isInitialized || !isAuthenticated) return;

    try {
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

  useEffect(() => {
    if (!state?.isInitialized || !isAuthenticated) return;

    let cancelled = false;

    async function run() {
      try {
        const res = await listMyNotifications({
          only_unread: true,
          page: 1,
          per_page: 1,
        });
        if (!cancelled) {
          setUnreadCount(res.meta?.total ?? 0);
        }
      } catch {
        if (!cancelled) {
          setUnreadCount(0);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [state?.isInitialized, isAuthenticated]);

  const value: NotificationContextValue = useMemo(
    () => ({
      unreadCount,
      refreshUnreadCount,
      decrementUnreadCount,
    }),
    [unreadCount, refreshUnreadCount, decrementUnreadCount]
  );

  useEffect(() => {
    if (!state?.isInitialized || !isAuthenticated) return;
    refreshUnreadCount().catch(() => {});
  }, [state?.isInitialized, pathname, refreshUnreadCount, isAuthenticated]);

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
