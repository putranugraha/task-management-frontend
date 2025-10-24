"use client";
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
};

export function useMilestoneColumns(
  { onDelete, onChanged, onComplete }:
  { onDelete?: (row: MilestoneRow) => void; onChanged?: () => void; onComplete?: (row: MilestoneRow) => void; }
): Column<MilestoneRow>[] {
  return [
    { key: "name", header: "Name" },
    { key: "status", header: "Status" },
    { key: "due_planned", header: "Due Planned", render: (r) => r.due_planned ?? '-' },
    { key: "due_actual", header: "Due Actual", render: (r) => r.due_actual ?? '-' },
    {
      key: "actions",
      header: "Actions",
      render: (row) => <RowActions row={row} onDelete={onDelete} onChanged={onChanged} onComplete={onComplete} />,
    },
  ];
}

function RowActions({ row, onDelete, onChanged, onComplete }: { row: MilestoneRow; onDelete?: (row: MilestoneRow) => void; onChanged?: () => void; onComplete?: (row: MilestoneRow) => void; }) {
  const isCompleted = (row.status || '').toLowerCase() === 'completed';
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/milestones/${row.id}`}>Detail</a>
      <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/milestones/${row.id}/edit`}>Edit</a>
      <button
        className="px-2 py-1 rounded-md border hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isCompleted}
        onClick={() => onComplete?.(row)}
        title={isCompleted ? 'Already completed' : 'Mark milestone as completed'}
      >Complete</button>
      <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => onDelete?.(row)}>Delete</button>
    </div>
  );
}
