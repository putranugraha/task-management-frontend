"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Division } from "@/types/division";
import DataTable from "../users/data-table";
import { useDivisionColumns, type DivisionRow, type Column } from "./columns";

type MaybePaginated<T> =
  | T[]
  | { data: T[] }
  | { data: { data: T[] } }
  | { divisions: T[] }
  | { items: T[] };

export default function DivisionsPage() {
  const [rows, setRows] = useState<DivisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickList = (res: any): any[] => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.divisions)) return res.divisions;
    if (Array.isArray(res?.items)) return res.items;
    return [];
  };

  const fetchDivisions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MaybePaginated<Division>>("GET", "/api/divisions?with_users=true&with_users_count=true");
      const list = pickList(res);
      const mapped: DivisionRow[] = list.map((d: any) => {
        let users: { id: number; name: string }[] | undefined = undefined;
        const rawUsers = d?.users ?? d?.members ?? d?.users_list;
        if (Array.isArray(rawUsers)) {
          users = rawUsers.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email ?? String(u.id) }));
        } else if (rawUsers && Array.isArray(rawUsers?.data)) {
          users = rawUsers.data.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email ?? String(u.id) }));
        }
        return {
          id: Number(d.id),
          code: String(d.code ?? ''),
          name: d.name ?? d.division_name ?? d.title ?? d.label ?? String(d.code ?? ''),
          description: d.description ?? null,
          created_at: d.created_at ?? '',
          users,
          users_count: typeof d.users_count === 'number' ? d.users_count : (Array.isArray(users) ? users.length : undefined),
        } as DivisionRow;
      });
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load divisions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDivisions(); }, []);

  const handleDelete = async (row: DivisionRow) => {
    const ok = confirm(`Hapus division ${row.name}?`);
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/divisions/${row.id}`);
      await fetchDivisions();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menghapus division");
    }
  };

  const columns = useDivisionColumns(handleDelete, { minimal: true }) as unknown as Column<DivisionRow>[];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Divisions</h2>
        <Link href="/dashboard/divisions/create" className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Create Division</Link>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      <DataTable columns={columns as any} data={rows} loading={loading} />
    </div>
  );
}
