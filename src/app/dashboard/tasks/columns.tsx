"use client";

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
  key: keyof T | "actions";
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function useTaskColumns(onDelete?: (row: TaskRow) => void): Column<TaskRow>[] {
  return [
    { key: "title", header: "Title" },
    { key: "project", header: "Project", render: (r) => r.project?.name ?? '-' },
    { key: "priority", header: "Priority" },
    { key: "status", header: "Status" },
    { key: "start_planned", header: "Start", render: (r) => r.start_planned ?? '-' },
    { key: "end_planned", header: "End", render: (r) => r.end_planned ?? '-' },
    { key: "percent_complete", header: "%", render: (r) => `${r.percent_complete ?? 0}%` },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2 text-sm">
          <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/tasks/${row.id}/edit`}>Edit</a>
          <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => onDelete?.(row)}>Delete</button>
        </div>
      ),
    },
  ];
}

