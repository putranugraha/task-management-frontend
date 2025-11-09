"use client";

import Link from "next/link";
import { ArrowRight, Pencil, Trash2 } from "lucide-react";

export type MilestoneRow = {
  id: number;
  name: string;
  project?: { id: number; name: string } | null;
  due_planned?: string | null;
  due_actual?: string | null;
  status: string;
};

export type Column<T> = {
  key: keyof T | "actions";
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
};

export function useMilestoneColumns(
  onDeleteOrHandlers?: ((row: MilestoneRow) => void) | { onDelete?: (row: MilestoneRow) => void; onDetail?: (row: MilestoneRow) => void; onComplete?: (row: MilestoneRow) => void }
): Column<MilestoneRow>[] {
  const handlers = typeof onDeleteOrHandlers === 'function'
    ? { onDelete: onDeleteOrHandlers }
    : (onDeleteOrHandlers || {});

  return [
    {
      key: "name",
      header: "Name",
      className: "min-w-[220px]",
      render: (r) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{r.name}</div>
          {r.project?.name && (
            <div className="mt-0.5 text-xs text-slate-500">
              {r.project.name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "project",
      header: "Project",
      className: "min-w-[140px]",
      render: (r) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {r.project?.name ?? '-'}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => (
        <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusClasses(r.status ?? "")].join(" ")}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          {r.status ?? '-'}
        </span>
      ),
    },
    { key: "due_planned", header: "Due Planned", className: "min-w-[120px]", render: (r) => r.due_planned ?? '-' },
    { key: "due_actual", header: "Due Actual", className: "min-w-[120px]", render: (r) => r.due_actual ?? '-' },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      className: "min-w-[190px]",
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          <Link
            className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#00674F]/10 text-[#00674F] transition hover:bg-[#00674F]/20"
            href={`/dashboard/milestones/${row.id}/edit`}
            title={`Edit ${row.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => handlers.onDelete?.(row)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#DC2626]/10 text-[#DC2626] transition hover:bg-[#DC2626]/20"
            title={`Delete ${row.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {handlers.onDetail ? (
            <button
              type="button"
              onClick={() => handlers.onDetail?.(row)}
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-[#008061]"
            >
              Detail
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Link
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-[#008061]"
              href={`/dashboard/milestones/${row.id}`}
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

function statusClasses(value: string) {
  const s = (value || '').toLowerCase();
  if (s.includes('overdue')) return 'bg-rose-50 text-rose-600 ring-1 ring-rose-200';
  if (s.includes('completed') || s.includes('complete')) return 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200';
  if (s.includes('in progress')) return 'bg-sky-50 text-sky-600 ring-1 ring-sky-200';
  if (s.includes('on hold')) return 'bg-amber-50 text-amber-600 ring-1 ring-amber-200';
  if (s.includes('planned')) return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
}
