"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import {
  AlertCircle,
  ArrowRight,
  Mail,
  ShieldCheck,
  UserCheck,
  UserX,
  Pencil,
} from "lucide-react";

export type UserRow = {
  id: number;
  name: string;
  email: string;
  job_title: string | null;
  is_active: boolean;
  status: string;
  role?: string | null;
  division?: { id: number; name: string } | null;
  created_at?: string;
};

export type Column<T> = {
  key: keyof T | "actions" | string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

const getInitials = (name?: string | null, fallback?: string | null) => {
  const source = (name ?? fallback ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).slice(0, 2);
  return parts
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
};

const statusClasses = (value: string) => {
  const status = value.toLowerCase();
  if (status.includes("non") || status.includes("inaktif") || status.includes("inactive")) {
    return "bg-rose-50 text-rose-500 ring-1 ring-rose-200";
  }
  if (status.includes("pending") || status.includes("wait")) {
    return "bg-amber-50 text-amber-500 ring-1 ring-amber-200";
  }
  return "bg-emerald-50 text-emerald-500 ring-1 ring-emerald-200";
};

const isInactiveUser = (row: UserRow) => {
  const status = String(row.status ?? "").toLowerCase();
  return !row.is_active || status.includes("non") || status.includes("inaktif") || status.includes("inactive");
};

export function useUserColumns(
  onDeactivate?: (row: UserRow) => void,
  opts?: {
    minimal?: boolean;
    onDetail?: (row: UserRow) => void;
    onActivate?: (row: UserRow) => void;
    activatingId?: number | null;
    canEdit?: boolean;
    canDelete?: boolean;
    currentUserId?: number | null;
  }
): Column<UserRow>[] {
  const handleDeactivate = useCallback((row: UserRow) => {
    if (onDeactivate) onDeactivate(row);
  }, [onDeactivate]);

  const minimal = opts?.minimal === true;
  const canEdit = opts?.canEdit ?? true;
  const canDelete = opts?.canDelete ?? true;
  const currentUserId = opts?.currentUserId ?? null;

  const baseCols: Column<UserRow>[] = useMemo(() => ([
    {
      key: "name",
      header: "Name",
      className: "min-w-[240px]",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm font-semibold grid place-items-center shadow-[0_6px_14px_rgba(37,99,235,0.25)]">
            {getInitials(row.name, row.email)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{row.name ?? "-"}</div>
            {row.email && (
              <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                <Mail className="h-3 w-3" />
                <span className="truncate max-w-[140px] md:max-w-[220px]">{row.email}</span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      className: "min-w-[120px]",
      render: (row) => (
        <span className="text-sm font-medium text-slate-600">
          {row.role ?? "-"}
        </span>
      ),
    },
    {
      key: "division",
      header: "Division",
      className: "min-w-[140px]",
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {row.division?.name ?? "-"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (row) => (
        <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusClasses(row.status ?? "")].join(" ")}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          {row.status ?? "-"}
        </span>
      ),
    },
    {
      key: "created_at_date",
      header: "Date",
      className: "min-w-[120px]",
      render: (row) => {
        if (!row.created_at) return <span className="text-slate-400">-</span>;
        const date = new Date(row.created_at);
        return <span className="text-sm font-medium text-slate-700">{date.toLocaleDateString()}</span>;
      },
    },
    {
      key: "created_at_time",
      header: "Time",
      align: "center",
      render: (row) => {
        if (!row.created_at) return <span className="text-slate-400">-</span>;
        const date = new Date(row.created_at);
        return <span className="text-sm font-semibold text-slate-700">{date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>;
      },
    },
    {
      key: "situation",
      header: "Situation",
      align: "center",
      render: (row) => (
        row.is_active ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
            <ShieldCheck className="h-4 w-4" />
            Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
            <AlertCircle className="h-4 w-4" />
            Inactive
          </span>
        )
      ),
    },
  ]), []);

  if (minimal) {
    const compact = baseCols.filter((col) => ["name", "role", "status"].includes(String(col.key)));
    return [
      ...compact,
      {
        key: "actions",
        header: "Actions",
        align: "right",
        render: (row) => (
          opts?.onDetail ? (
            <button
              type="button"
              onClick={() => opts.onDetail?.(row)}
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#008061]"
            >
              Detail
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#008061]"
              href={`/dashboard/users/${row.id}`}
            >
              Detail
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )
        ),
      },
    ];
  }

  return [
    ...baseCols,
    {
      key: "actions",
      header: "Actions",
      align: "right",
      className: "min-w-[190px]",
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          {canEdit && (
            <Link
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#00674F]/10 text-[#00674F] transition hover:bg-[#00674F]/20"
              href={`/dashboard/users/${row.id}/edit`}
              title={`Edit ${row.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
          {canEdit && isInactiveUser(row) && (
            <button
              type="button"
              onClick={() => opts?.onActivate?.(row)}
              disabled={Number(opts?.activatingId) === Number(row.id)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
              title={`Aktifkan ${row.name}`}
            >
              <UserCheck className="h-4 w-4" />
            </button>
          )}
          {canDelete && !isInactiveUser(row) && Number(row.id) !== Number(currentUserId) && (
            <button
              type="button"
              onClick={() => handleDeactivate(row)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-amber-50 text-amber-600 transition hover:bg-amber-100"
              title={`Nonaktifkan ${row.name}`}
            >
              <UserX className="h-4 w-4" />
            </button>
          )}
          {opts?.onDetail ? (
            <button
              type="button"
              onClick={() => opts.onDetail?.(row)}
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-[#008061]"
            >
              Detail
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-[#008061]"
              href={`/dashboard/users/${row.id}`}
            >
              Detail
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ),
    },
  ];
}
