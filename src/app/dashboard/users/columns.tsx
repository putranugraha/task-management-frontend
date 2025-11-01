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
  key: keyof T | "actions" | string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

export function useUserColumns(onDelete?: (row: UserRow) => void, opts?: { minimal?: boolean }): Column<UserRow>[] {
  const handleDelete = useCallback((row: UserRow) => {
    if (onDelete) onDelete(row);
  }, [onDelete]);

  const minimal = opts?.minimal === true;

  const badge = (status: string) => {
    const value = (status ?? "").toLowerCase();
    if (value.includes("non") || value.includes("inactive")) {
      return "bg-rose-100 text-rose-700 border border-rose-200";
    }
    if (value.includes("pending") || value.includes("wait")) {
      return "bg-amber-100 text-amber-700 border border-amber-200";
    }
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  };

  const baseCols: Column<UserRow>[] = [
    { key: "name", header: "Name" },
    { key: "role", header: "Role" },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => (
        <span className={["inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full", badge(r.status ?? "")].join(" ")}>
          {r.status ?? "-"}
        </span>
      ),
    },
  ];

  const fullCols: Column<UserRow>[] = [
    { key: "name", header: "Name" },
    { key: "email", header: "Email" },
    { key: "role", header: "Role" },
    { key: "division", header: "Division", render: (r) => r.division?.name ?? "-" },
    { key: "job_title", header: "Job Title", render: (r) => r.job_title ?? "-" },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => (
        <span className={["inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full", badge(r.status ?? "")].join(" ")}>
          {r.status ?? "-"}
        </span>
      ),
    },
    { key: "is_active", header: "Active", align: "center", render: (r) => r.is_active ? "Yes" : "No" },
    { key: "created_at", header: "Created At", render: (r) => r.created_at ? new Date(r.created_at).toLocaleString() : "-" },
  ];

  const cols = minimal ? baseCols : fullCols;

  return [
    ...cols,
    {
      key: "actions",
      header: "Actions",
      align: "center",
      render: (row) => (
        <div className="flex gap-2 text-sm">
          <Link className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/users/${row.id}/edit`}>Edit</Link>
          <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => handleDelete(row)}>Delete</button>
        </div>
      ),
    },
  ];
}
