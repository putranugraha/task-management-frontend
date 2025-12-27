"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open || typeof document === "undefined") return null;

  const confirmClasses =
    variant === "danger"
      ? "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/25"
      : "bg-[#00674F] hover:bg-[#008061] text-white shadow-lg shadow-emerald-500/25";

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => !loading && onCancel()}
      />
      <div className="relative z-10 w-full max-w-md transform rounded-3xl bg-white/95 p-5 shadow-[0_24px_48px_rgba(15,23,42,0.22)] ring-1 ring-slate-100 animate-[fade-in-down_0.22s_ease-out]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Confirmation
            </p>
            <h2 className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && (
          <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
            {children}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition disabled:opacity-60",
              confirmClasses
            )}
          >
            {loading && (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
