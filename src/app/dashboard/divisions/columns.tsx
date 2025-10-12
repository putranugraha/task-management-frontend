"use client";

export type DivisionRow = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  users?: { id: number; name: string }[];
  users_count?: number;
  created_at?: string;
};

export type Column<T> = {
  key: keyof T | "actions";
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function useDivisionColumns(onDelete?: (row: DivisionRow) => void): Column<DivisionRow>[] {
  return [
    { key: "code", header: "Code" },
    { key: "name", header: "Name" },
    {
      key: "users_count",
      header: "Users",
      render: (r) => {
        if (Array.isArray(r.users) && r.users.length > 0) {
          return r.users.map((u) => u.name).join(', ');
        }
        if (typeof r.users_count === 'number') return r.users_count;
        return '-';
      }
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2 text-sm">
          <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/divisions/${row.id}/edit`}>Edit</a>
          <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => onDelete?.(row)}>Delete</button>
        </div>
      ),
    },
  ];
}
