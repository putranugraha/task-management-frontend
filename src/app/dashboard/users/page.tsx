"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { User as UserType } from "@/types/user";
import DataTable from "./data-table";
import { useUserColumns, type UserRow } from "./columns";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MaybePaginated<UserType>>("GET", "/api/users");
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      const mapped: UserRow[] = list.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        job_title: (u as any).job_title ?? null,
        is_active: (u as any).is_active ?? true,
        status: (u as any).status ?? "Aktif",
        role: (u as any).role ?? null,
        created_at: (u as any).created_at,
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (row: UserRow) => {
    const ok = confirm(`Hapus user ${row.name}?`);
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/users/${row.id}`);
      await fetchUsers();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menghapus user");
    }
  };

  const columns = useUserColumns(handleDelete);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Users</h2>
        <Link href="/dashboard/users/create" className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Create User</Link>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      <DataTable columns={columns as any} data={rows} loading={loading} />
    </div>
  );
}

