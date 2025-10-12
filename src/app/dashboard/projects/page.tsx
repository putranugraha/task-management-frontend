"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import DataTable from "../users/data-table";
import { useProjectColumns, type ProjectRow, type Column } from "./columns";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

export default function ProjectsPage() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MaybePaginated<Project>>("GET", "/api/projects");
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      const mapped: ProjectRow[] = list.map((p: any) => {
        // Normalize division owner name from common shapes
        const owner = p.division_owner || p.owner || p.project_owner || null;
        const ownerObj = owner
          ? { id: Number(owner.id ?? owner.user_id ?? 0), name: owner.name ?? owner.full_name ?? owner.email ?? 'Unknown' }
          : null;
        return {
          id: Number(p.id),
          name: p.name,
          client_name: p.client_name ?? p.client ?? '-',
          value_amount: typeof p.value_amount === 'string' ? p.value_amount : Number(p.value_amount ?? 0),
          scope: undefined,
          status: p.status ?? 'Planned',
          division_owner: ownerObj,
          start_planned: p.start_planned ?? null,
          end_planned: p.end_planned ?? null,
          created_at: p.created_at,
        } as ProjectRow & { scope?: string };
      });
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const handleDelete = async (row: ProjectRow) => {
    const ok = confirm(`Hapus project ${row.name}?`);
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/projects/${row.id}`);
      await fetchProjects();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menghapus project");
    }
  };

  const columns = useProjectColumns(handleDelete) as unknown as Column<ProjectRow>[];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Projects</h2>
        <Link href="/dashboard/projects/create" className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Create Project</Link>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      <DataTable columns={columns as any} data={rows} loading={loading} />
    </div>
  );
}

