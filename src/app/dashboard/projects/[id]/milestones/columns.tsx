"use client";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import type { Milestone } from "@/types/milestone";

export type MilestoneRow = Pick<Milestone, 'id' | 'name' | 'status' | 'due_planned'> & {
  project?: { id: number; name: string } | null;
  due_actual?: string | null;
};

export type Column<T> = {
  key: keyof T | "actions";
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

export function useMilestoneColumns(
  {
    onDelete,
    onChanged,
    onComplete,
    canManage,
  }: {
    onDelete?: (row: MilestoneRow) => void;
    onChanged?: () => void;
    onComplete?: (row: MilestoneRow) => void;
    canManage?: boolean;
  }
): Column<MilestoneRow>[] {
  return [
    { key: "name", header: "Name" },
    { key: "status", header: "Status" },
    { key: "due_planned", header: "Due Planned", render: (r) => r.due_planned ?? '-' },
    { key: "due_actual", header: "Due Actual", render: (r) => r.due_actual ?? '-' },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      render: (row) => (
        <RowActions
          row={row}
          onDelete={onDelete}
          onChanged={onChanged}
          onComplete={onComplete}
          canManage={canManage}
        />
      ),
    },
  ];
}

function RowActions({
  row,
  onDelete,
  onChanged,
  onComplete,
  canManage = true,
}: {
  row: MilestoneRow;
  onDelete?: (row: MilestoneRow) => void;
  onChanged?: () => void;
  onComplete?: (row: MilestoneRow) => void;
  canManage?: boolean;
}) {
  const isCompleted = (row.status || '').toLowerCase() === 'completed';
  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-3 text-sm">
      {canManage && (
        <>
          <Link
            href={`/dashboard/milestones/${row.id}/edit`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#00674F]/10 text-[#00674F] transition hover:bg-[#00674F]/20"
            title={`Edit ${row.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            type="button"
            disabled={isCompleted}
            onClick={() => onComplete?.(row)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              isCompleted ? "Already completed" : "Mark milestone as completed"
            }
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(row)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#DC2626]/10 text-[#DC2626] transition hover:bg-[#DC2626]/20"
            title={`Delete ${row.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
      <Link
        href={`/dashboard/milestones/${row.id}`}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#00674F] px-4 text-xs font-semibold leading-none text-white shadow-md transition hover:bg-[#008061]"
      >
        Detail
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
