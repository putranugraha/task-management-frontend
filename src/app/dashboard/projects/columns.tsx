"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";

export type ProjectRow = {
  id: number;
  name: string;
  client_name: string;
  value_amount: number | string;
  status: string;
  division_owner?: { id: number; name: string } | null;
  start_planned?: string | null;
  end_planned?: string | null;
  created_at?: string;
};

export type Column<T> = {
  key: keyof T | "actions" | string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

export function useProjectColumns(
  onDelete?: (row: ProjectRow) => void,
  opts?: {
    minimal?: boolean;
    onDetail?: (row: ProjectRow) => void;
    canManage?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
  }
): Column<ProjectRow>[] {
  const minimal = opts?.minimal === true;
  const canManage = opts?.canManage !== false;
  const canEdit = opts?.canEdit ?? canManage;
  const canDelete = opts?.canDelete ?? canManage;

  const currency = (v: number | string | undefined) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (typeof n === 'number' && Number.isFinite(n)) {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
      } catch {
        return `IDR ${Math.round(n).toLocaleString()}`;
      }
    }
    return String(v ?? '');
  };

  const fullCols: Column<ProjectRow>[] = [
    {
      key: "name",
      header: "Project",
      className: "min-w-[220px]",
      render: (r) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{r.name}</div>
          {r.client_name && (
            <div className="mt-0.5 text-xs text-slate-500">{r.client_name}</div>
          )}
        </div>
      ),
    },
    { key: "status", header: "Status", align: "center", render: (r) => (
      <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
        {r.status ?? '-'}
      </span>
    ) },
    { key: "start_planned", header: "Start", render: (r) => r.start_planned ? new Date(r.start_planned).toLocaleDateString() : '-' },
    { key: "end_planned", header: "End", render: (r) => r.end_planned ? new Date(r.end_planned).toLocaleDateString() : '-' },
    { key: "value_amount", header: "Value", align: "right", render: (r) => <span className="font-semibold">{currency(r.value_amount)}</span> },
    { key: "division_owner", header: "Owner", render: (r) => r.division_owner?.name ?? '-' },
  ];

  const minimalCols: Column<ProjectRow>[] = [
    { key: "name", header: "Project", className: "min-w-[220px]" },
    { key: "status", header: "Status", align: "center" },
    { key: "start_planned", header: "Start" },
    { key: "end_planned", header: "End" },
  ];

  const cols = minimal ? minimalCols : fullCols;

  return [
    ...cols,
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#008061]"
            href={`/dashboard/projects/${row.id}`}
          >
            Detail
          </Link>
          {(canEdit || canDelete) && (
            <>
              {canEdit && (
              <Link
                className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#00674F]/10 text-[#00674F] transition hover:bg-[#00674F]/20"
                href={`/dashboard/projects/${row.id}/edit`}
                title={`Edit ${row.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Link>
              )}
              {canDelete && (
              <button
                type="button"
                onClick={() => onDelete?.(row)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#DC2626]/10 text-[#DC2626] transition hover:bg-[#DC2626]/20"
                title={`Delete ${row.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];
}
