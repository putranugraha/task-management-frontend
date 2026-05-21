"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastOptions = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastInternal = ToastOptions & { id: number };

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);

  const showToast = useCallback((options: ToastOptions) => {
    const id = Date.now() + Math.random();
    const { duration = 3500, ...rest } = options;

    setToasts((prev) => [...prev, { id, ...rest }]);

    if (duration > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 p-4 md:items-end md:p-6">
        {toasts.map((toast) => {
          const variant: ToastVariant = toast.variant ?? "info";
          const baseClasses =
            "pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 shadow-lg shadow-emerald-950/10 bg-white/95 backdrop-blur-sm transition-all duration-300 animate-[fade-in-down_0.25s_ease-out] flex items-start gap-3";
          const variantClasses = getVariantClasses(variant);

          return (
            <div
              key={toast.id}
              className={cn(baseClasses, variantClasses.container)}
              role="status"
            >
              <div
                className={cn(
                  "mt-0.5 h-6 w-6 flex items-center justify-center rounded-full text-xs font-semibold",
                  variantClasses.badge
                )}
              >
                {variant === "success"
                  ? "✓"
                  : variant === "error"
                  ? "!"
                  : variant === "warning"
                  ? "!"
                  : "i"}
              </div>
              <div className="min-w-0 flex-1">
                {toast.title && (
                  <p className="text-sm font-semibold text-slate-800">
                    {toast.title}
                  </p>
                )}
                {toast.description && (
                  <p className="mt-0.5 text-xs text-slate-600">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="ml-1 mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                aria-label="Close notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

function getVariantClasses(variant: ToastVariant) {
  switch (variant) {
    case "success":
      return {
        container:
          "border-emerald-100 bg-emerald-50/95 text-emerald-900 shadow-[0_18px_36px_rgba(16,185,129,0.22)]",
        badge: "bg-[#00674F] text-emerald-50",
      };
    case "error":
      return {
        container:
          "border-rose-100 bg-rose-50/95 text-rose-900 shadow-[0_18px_36px_rgba(225,29,72,0.18)]",
        badge: "bg-rose-500 text-rose-50",
      };
    case "warning":
      return {
        container:
          "border-amber-100 bg-amber-50/95 text-amber-900 shadow-[0_18px_36px_rgba(245,158,11,0.18)]",
        badge: "bg-amber-500 text-amber-50",
      };
    case "info":
    default:
      return {
        container:
          "border-sky-100 bg-sky-50/95 text-sky-900 shadow-[0_18px_36px_rgba(56,189,248,0.18)]",
        badge: "bg-sky-500 text-sky-50",
      };
  }
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

