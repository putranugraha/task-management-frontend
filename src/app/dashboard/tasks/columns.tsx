"use client";

import Link from "next/link";
import { Pencil, Trash2, ArrowRight } from "lucide-react";

export type TaskRow = {
  id: number;
  title: string;
  project?: { id: number; name: string } | null;
  priority: string;
  status: string;
  start_planned?: string | null;
  end_planned?: string | null;
  percent_complete: number;
};

export type Column<T> = {
  key: keyof T | "actions" | string;
  header: string;
  render?: (row: T, index?: number) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

export function useTaskColumns(
  onDelete?: (row: TaskRow) => void,
  opts?: { onDetail?: (row: TaskRow) => void; canManage?: boolean }
): Column<TaskRow>[] {
  const canManage = opts?.canManage !== false;
  return [
    { key: "title", header: "Title", className: "min-w-[220px]" },
    { key: "project", header: "Project", className: "min-w-[160px]", render: (r) => r.project?.name ?? '-' },
    { key: "priority", header: "Priority", className: "min-w-[120px]" },
    { key: "status", header: "Status", className: "min-w-[140px]" },
    { key: "start_planned", header: "Start", render: (r) => r.start_planned ?? '-' },
    { key: "end_planned", header: "End", render: (r) => r.end_planned ?? '-' },
    { key: "percent_complete", header: "%", align: "center", render: (r) => `${r.percent_complete ?? 0}%` },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      className: "min-w-[190px]",
      render: (row) => (
        <div className="flex items-center justify-end gap-3">
          {canManage && (
            <>
              <Link
                className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#00674F]/10 text-[#00674F] transition hover:bg-[#00674F]/20"
                href={`/dashboard/tasks/${row.id}/edit`}
                title={`Edit ${row.title}`}
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => onDelete?.(row)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#DC2626]/10 text-[#DC2626] transition hover:bg-[#DC2626]/20"
                title={`Delete ${row.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
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
              href={`/dashboard/tasks/${row.id}`}
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
