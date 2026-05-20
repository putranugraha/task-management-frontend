"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArchiveRestore, ChevronLeft, RotateCcw, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import Forbidden from "@/components/auth/Forbidden";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import DataTable from "../../users/data-table";
import type { Column, ProjectRow } from "../columns";
import { useToast } from "@/components/ui/toast";

type MaybePaginated<T> = T[] | { data?: T[] };

function mapProject(row: any): ProjectRow {
  const owner = row?.division_owner || row?.owner || row?.project_owner || null;
  return {
    id: Number(row?.id),
    name: row?.name ?? "-",
    client_name: row?.client_name ?? row?.client ?? "-",
    value_amount: typeof row?.value_amount === "string" ? row.value_amount : Number(row?.value_amount ?? 0),
    status: row?.status ?? "Archived",
    division_owner: owner
      ? { id: Number(owner.id ?? owner.user_id ?? 0), name: owner.name ?? owner.full_name ?? owner.email ?? "Unknown" }
      : null,
    start_planned: row?.start_planned ?? null,
    end_planned: row?.end_planned ?? null,
    created_at: row?.created_at,
  };
}

export default function ProjectArchivePage() {
  const { loading: authLoading, allowed } = usePermissionGuard([
    "melihat project",
    "menghapus project",
  ]);
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoreLoadingId, setRestoreLoadingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function loadArchivedProjects() {
    setLoading(true);
    setError(null);

    const endpoints = [
      "/api/projects/archived",
      "/api/projects/archive",
      "/api/projects?archived=1",
      "/api/projects?only_trashed=1",
    ];

    let lastMessage = "Belum ada endpoint archive project di backend.";
    for (const endpoint of endpoints) {
      try {
        const res = await apiRequest<MaybePaginated<any>>("GET", endpoint);
        const list = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : []);
        setRows(list.map(mapProject).filter((item) => Number.isFinite(item.id)));
        setError(null);
        return;
      } catch (e: any) {
        const status = e?.response?.status;
        lastMessage = e?.response?.data?.message || e?.message || lastMessage;
        if (status && ![404, 405].includes(Number(status))) {
          break;
        }
      }
    }

    setRows([]);
    setError(lastMessage);
  }

  async function restoreProject(row: ProjectRow) {
    setRestoreLoadingId(row.id);
    try {
      await apiRequest("PATCH", `/api/projects/${row.id}/restore`);
      showToast({
        variant: "success",
        title: "Project restored",
        description: `Project "${row.name}" dikembalikan ke daftar aktif.`,
      });
      await loadArchivedProjects();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Gagal restore project";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal restore project",
        description: msg,
      });
    } finally {
      setRestoreLoadingId(null);
    }
  }

  async function permanentlyDeleteProject() {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    try {
      await apiRequest("DELETE", `/api/projects/${deleteTarget.id}/force`);
      showToast({
        variant: "success",
        title: "Project dihapus permanen",
        description: `Project "${deleteTarget.name}" beserta milestone, task, progress, biaya, baseline, komentar, dan attachment terkait sudah dihapus.`,
      });
      setDeleteTarget(null);
      await loadArchivedProjects();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Gagal menghapus project permanen";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal hapus permanen",
        description: msg,
      });
    } finally {
      setDeleteLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    if (!authLoading && allowed) {
      loadArchivedProjects().finally(() => mounted && setLoading(false));
    }

    return () => {
      mounted = false;
    };
  }, [authLoading, allowed]);

  const columns = useMemo<Column<ProjectRow>[]>(() => [
    {
      key: "name",
      header: "Project",
      className: "min-w-[220px]",
      render: (row) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{row.name}</div>
          <div className="text-xs text-slate-400">{row.client_name}</div>
        </div>
      ),
    },
    { key: "status", header: "Status", className: "min-w-[120px]" },
    { key: "start_planned", header: "Start", render: (row) => row.start_planned ?? "-" },
    { key: "end_planned", header: "End", render: (row) => row.end_planned ?? "-" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => restoreProject(row)}
            disabled={restoreLoadingId === row.id || deleteLoading}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {restoreLoadingId === row.id ? "Restoring" : "Restore"}
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(row)}
            disabled={restoreLoadingId === row.id || deleteLoading}
            className="inline-flex items-center gap-2 rounded-full border border-rose-100 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Permanent Delete
          </button>
        </div>
      ),
    },
  ], [restoreLoadingId, deleteLoading]);

  if (!authLoading && !allowed) {
    return <Forbidden />;
  }

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
            <Link href="/dashboard/projects" className="inline-flex items-center gap-1 transition hover:text-[#00674F]">
              <ChevronLeft className="h-4 w-4" />
              Projects
            </Link>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">Project Archive</h1>
          <p className="mt-1 text-sm text-slate-500">Project yang sudah di-archive akan muncul di sini.</p>
        </div>
        <div className="inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
          <ArchiveRestore className="h-4 w-4 text-[#00674F]" />
          Archived
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading || authLoading}
        emptyText="Belum ada project archive."
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus project permanen?"
        description={
          deleteTarget
            ? `Apakah kamu benar ingin menghapus project "${deleteTarget.name}" secara permanen? Semua milestone, task, dependencies, progress, biaya, baseline, komentar, dan attachment yang berkaitan dengan project ini akan hilang dan tidak bisa di-restore.`
            : ""
        }
        confirmLabel="Hapus Permanen"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteLoading}
        onConfirm={permanentlyDeleteProject}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
      />
    </div>
  );
}
