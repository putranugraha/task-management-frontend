"use client";

export type RoleRow = {
  id: number;
  name: string;
  status?: string | null;
  permissions: string[];
  permissions_count?: number;
  created_at?: string;
};

export type Column<T> = {
  key: keyof T | "actions";
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function useRoleColumns(onDelete?: (row: RoleRow) => void): Column<RoleRow>[] {
  return [
    { key: "name", header: "Name" },
    { key: "status", header: "Status", render: (r) => r.status ?? "-" },
    {
      key: "permissions",
      header: "Permissions",
      render: (r) => {
        if (r.permissions?.length) return r.permissions.join(", ");
        if (typeof r.permissions_count === 'number') return `${r.permissions_count} perms`;
        return "-";
      }
    },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2 text-sm">
          <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/roles/${row.id}/edit`}>Edit</a>
          <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => onDelete?.(row)}>Delete</button>
        </div>
      ),
    },
  ];
}
