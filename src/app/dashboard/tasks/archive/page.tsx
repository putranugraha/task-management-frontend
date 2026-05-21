"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArchiveRestore, ChevronLeft, RotateCcw } from "lucide-react";
import Forbidden from "@/components/auth/Forbidden";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import DataTable from "../../users/data-table";
import { listArchived, restore } from "@/lib/api/tasks";
import type { Task } from "@/types/task";
import type { Column, TaskRow } from "../columns";

function mapTask(item: Task): TaskRow {
  return {
    id: Number(item.id),
    title: item.title,
    project: item.project ?? null,
    priority: item.priority ?? "Medium",
    status: item.status ?? "To Do",
    start_planned: item.start_planned ?? null,
    end_planned: item.end_planned ?? null,
    percent_complete: Number(item.percent_complete ?? 0),
  };
}

function TaskArchiveContent() {
  const { state, can } = useAuth();
  const authLoading = !state.isInitialized || state.isLoading;
  const canAccessArchive = can("melihat tugas") && can("menghapus tugas");
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("project_id") || undefined;
  const milestoneId = searchParams?.get("milestone_id") || undefined;
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoreLoadingId, setRestoreLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function fetchArchived() {
    setLoading(true);
    setError(null);
    try {
      const list = await listArchived({ project_id: projectId, milestone_id: milestoneId });
      setRows(list.map(mapTask));
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Gagal memuat task archive";
      setRows([]);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function restoreTask(row: TaskRow) {
    setRestoreLoadingId(row.id);
    try {
      await restore(row.id);
      showToast({
        variant: "success",
        title: "Task restored",
        description: `Task "${row.title}" dikembalikan ke daftar aktif.`,
      });
      await fetchArchived();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Gagal restore task";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal restore task",
        description: msg,
      });
    } finally {
      setRestoreLoadingId(null);
    }
  }

  useEffect(() => {
    if (!authLoading && canAccessArchive) {
      fetchArchived();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canAccessArchive, projectId, milestoneId]);

  const columns = useMemo<Column<TaskRow>[]>(() => [
    {
      key: "title",
      header: "Task",
      className: "min-w-[220px]",
      render: (row) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{row.title}</div>
          <div className="text-xs text-slate-400">{row.project?.name ?? "-"}</div>
        </div>
      ),
    },
    { key: "priority", header: "Priority" },
    { key: "status", header: "Status" },
    { key: "start_planned", header: "Start", render: (row) => row.start_planned ?? "-" },
    { key: "end_planned", header: "End", render: (row) => row.end_planned ?? "-" },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => restoreTask(row)}
          disabled={restoreLoadingId === row.id}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {restoreLoadingId === row.id ? "Restoring" : "Restore"}
        </button>
      ),
    },
  ], [restoreLoadingId]);

  if (!authLoading && !canAccessArchive) {
    return <Forbidden />;
  }

  const backHref = projectId ? `/dashboard/projects/${projectId}/milestones` : "/dashboard/tasks";

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
            <Link href={backHref} className="inline-flex items-center gap-1 transition hover:text-[#00674F]">
              <ChevronLeft className="h-4 w-4" />
              Tasks
            </Link>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">Task Archive</h1>
          <p className="mt-1 text-sm text-slate-500">Task yang sudah di-archive akan muncul di sini.</p>
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
        emptyText="Belum ada task archive."
      />
    </div>
  );
}

export default function TaskArchivePage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-slate-500">Loading archive...</div>}>
      <TaskArchiveContent />
    </Suspense>
  );
}
