"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DataTable from "../../../users/data-table";
import { listByProject, remove } from "@/lib/api/milestones";
import type { Milestone } from "@/types/milestone";
import { useMilestoneColumns, type MilestoneRow } from "./columns";

export default function ProjectMilestonesPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listByProject(projectId);
      // Sort raw milestones to keep order stable even when status changes
      const sorted: Milestone[] = [...list].sort((a, b) => {
        const da = a.due_planned ? Date.parse(a.due_planned) : Number.POSITIVE_INFINITY;
        const db = b.due_planned ? Date.parse(b.due_planned) : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        const ca = a.created_at ? Date.parse(a.created_at) : 0;
        const cb = b.created_at ? Date.parse(b.created_at) : 0;
        if (ca !== cb) return ca - cb;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const mapped: MilestoneRow[] = sorted.map((m: Milestone) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        due_planned: m.due_planned,
        project: m.project ?? undefined,
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load milestones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (projectId) fetchList(); }, [projectId]);

  const handleDelete = async (row: MilestoneRow) => {
    const ok = confirm(`Hapus milestone ${row.name}?`);
    if (!ok) return;
    try {
      await remove(row.id);
      await fetchList();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menghapus milestone");
    }
  };

  const columns = useMilestoneColumns({ onDelete: handleDelete, onChanged: fetchList });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Project Milestones</h2>
        <Link href={`/dashboard/projects/${projectId}/milestones/create`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Create Milestone</Link>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      <DataTable columns={columns as any} data={rows} loading={loading} />
    </div>
  );
}
