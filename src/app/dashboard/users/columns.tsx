"use client";

import Link from "next/link";
import { useCallback } from "react";

export type UserRow = {
  id: number;
  name: string;
  email: string;
  job_title: string | null;
  is_active: boolean;
  status: string;
  role?: string | null;
  division?: { id: number; name: string } | null;
  created_at?: string;
};

export type Column<T> = {
  key: keyof T | "actions";
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function useUserColumns(onDelete?: (row: UserRow) => void): Column<UserRow>[] {
  const handleDelete = useCallback((row: UserRow) => {
    if (onDelete) onDelete(row);
  }, [onDelete]);

  return [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "role", header: "Role" },
    { key: "division", header: "Division", render: (r) => r.division?.name ?? "-" },
    { key: "job_title", header: "Job Title", render: (r) => r.job_title ?? "-" },
    { key: "status", header: "Status" },
    { key: "is_active", header: "Active", render: (r) => r.is_active ? "Yes" : "No" },
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2 text-sm">
          <Link className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/users/${row.id}/edit`}>Edit</Link>
          <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => handleDelete(row)}>Delete</button>
        </div>
      ),
    },
  ];
}
