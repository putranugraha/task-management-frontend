"use client";

import Link from "next/link";
import { ArrowRight, Pencil, ShieldCheck, ShieldX } from "lucide-react";

export type RoleRow = {
  id: number;
  name: string;
  status?: string | null;
  permissions: string[];
  permissions_count?: number;
  created_at?: string;
};

export type Column<T> = {
  key: keyof T | "actions" | string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

const statusClasses = (value?: string | null) => {
  const v = (value ?? "").toLowerCase();
  if (v.includes("non") || v.includes("inaktif") || v.includes("inactive") || v.includes("no")) {
    return "bg-rose-50 text-rose-500 ring-1 ring-rose-200";
  }
  return "bg-emerald-50 text-emerald-500 ring-1 ring-emerald-200";
};

const isInactiveRole = (row: RoleRow) => {
  const status = String(row.status ?? "").toLowerCase();
  return status.includes("non") || status.includes("inaktif") || status.includes("inactive") || status.includes("no");
};

export function useRoleColumns(
  onDeactivate?: (row: RoleRow) => void,
  opts?: {
    onDetail?: (row: RoleRow) => void;
    onActivate?: (row: RoleRow) => void;
    activatingId?: number | null;
    currentRoleNames?: string[];
    canEdit?: boolean;
    canDelete?: boolean;
  }
): Column<RoleRow>[] {
  const canEdit = opts?.canEdit ?? true;
  const canDelete = opts?.canDelete ?? true;
  const currentRoleNames = new Set((opts?.currentRoleNames ?? []).map((role) => role.toLowerCase()));

  return [
    {
      key: "name",
      header: "Name",
      className: "min-w-[220px]",
      render: (row) => (
        <span className="text-sm font-semibold text-slate-900">{row.name ?? '-'}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (row) => (
        <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusClasses(row.status)].join(" ")}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          {row.status ?? '-'}
        </span>
      ),
    },
    {
      key: "permissions_count",
      header: "Permissions",
      className: "min-w-[180px]",
      render: (row) => (
        row.permissions?.length ? (
          <span className="text-sm font-medium text-slate-600 truncate block max-w-[360px]">{row.permissions.join(", ")}</span>
        ) : typeof row.permissions_count === 'number' ? (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{row.permissions_count} perms</span>
        ) : (
          <span className="text-slate-400">-</span>
        )
      ),
    },
    {
      key: "created_at",
      header: "Date",
      className: "min-w-[120px]",
      render: (row) => {
        if (!row.created_at) return <span className="text-slate-400">-</span>;
        const d = new Date(row.created_at);
        return <span className="text-sm font-medium text-slate-700">{d.toLocaleDateString()}</span>;
      },
    },
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
              href={`/dashboard/roles/${row.id}/edit`}
              title={`Edit ${row.name}`}
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
          {canEdit && isInactiveRole(row) && (
            <button
              type="button"
              onClick={() => opts?.onActivate?.(row)}
              disabled={Number(opts?.activatingId) === Number(row.id)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-60"
              title={`Aktifkan ${row.name}`}
            >
              <ShieldCheck className="h-4 w-4" />
            </button>
          )}
          {canDelete && !isInactiveRole(row) && !currentRoleNames.has(String(row.name ?? "").toLowerCase()) && (
            <button
              type="button"
              onClick={() => onDeactivate?.(row)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-amber-50 text-amber-600 transition hover:bg-amber-100"
              title={`Nonaktifkan ${row.name}`}
            >
              <ShieldX className="h-4 w-4" />
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
          ) : null}
        </div>
      ),
    },
  ];
}
