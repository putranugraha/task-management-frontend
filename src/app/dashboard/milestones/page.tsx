"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Milestone } from "@/types/milestone";
import DataTable from "../users/data-table";
import { useMilestoneColumns, type MilestoneRow } from "./columns";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

export default function MilestonesPage() {
  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMilestones = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MaybePaginated<Milestone>>("GET", "/api/milestones");
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      const mapped: MilestoneRow[] = list.map((m: any) => ({
        id: m.id,
        name: m.name,
        project: m.project ? { id: m.project.id, name: m.project.name } : null,
        due_planned: m.due_planned ?? null,
        due_actual: m.due_actual ?? null,
        status: m.status ?? 'Planned',
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load milestones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMilestones(); }, []);

  const handleDelete = async (row: MilestoneRow) => {
    const ok = confirm(`Hapus milestone ${row.name}?`);
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/milestones/${row.id}`);
      await fetchMilestones();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menghapus milestone");
    }
  };

  const columns = useMilestoneColumns(handleDelete);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Milestones</h2>
        <Link href="/dashboard/milestones/create" className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Create Milestone</Link>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      <DataTable columns={columns as any} data={rows} loading={loading} />
    </div>
  );
}

