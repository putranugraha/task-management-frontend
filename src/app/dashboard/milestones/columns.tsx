"use client";

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
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function useMilestoneColumns(onDelete?: (row: MilestoneRow) => void): Column<MilestoneRow>[] {
  return [
    { key: "name", header: "Name" },
    { key: "project", header: "Project", render: (r) => r.project?.name ?? '-' },
    { key: "due_planned", header: "Due Planned", render: (r) => r.due_planned ?? '-' },
    { key: "due_actual", header: "Due Actual", render: (r) => r.due_actual ?? '-' },
    { key: "status", header: "Status" },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2 text-sm">
          <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/milestones/${row.id}/edit`}>Edit</a>
          <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => onDelete?.(row)}>Delete</button>
        </div>
      ),
    },
  ];
}

