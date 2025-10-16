"use client";
import type { Milestone } from "@/types/milestone";

export type MilestoneRow = Pick<Milestone, 'id' | 'name' | 'status' | 'due_planned'> & {
  project?: { id: number; name: string } | null;
};

export type Column<T> = {
  key: keyof T | "actions";
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function useMilestoneColumns({ onDelete, onChanged }: { onDelete?: (row: MilestoneRow) => void; onChanged?: () => void; }): Column<MilestoneRow>[] {
  return [
    { key: "name", header: "Name" },
    { key: "status", header: "Status" },
    { key: "due_planned", header: "Due Planned", render: (r) => r.due_planned ?? '-' },
    {
      key: "actions",
      header: "Actions",
      render: (row) => <RowActions row={row} onDelete={onDelete} onChanged={onChanged} />,
    },
  ];
}

function RowActions({ row, onDelete, onChanged }: { row: MilestoneRow; onDelete?: (row: MilestoneRow) => void; onChanged?: () => void; }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/milestones/${row.id}`}>Detail</a>
      <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/milestones/${row.id}/edit`}>Edit</a>
      <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => onDelete?.(row)}>Delete</button>
    </div>
  );
}
