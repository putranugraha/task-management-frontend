"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArchiveRestore, ChevronLeft, RotateCcw } from "lucide-react";
import Forbidden from "@/components/auth/Forbidden";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import DataTable from "../../users/data-table";
import { listArchived, restore } from "@/lib/api/milestones";
import { ArchivePagination, type ArchivePaginationMeta } from "@/components/dashboard/ArchivePagination";
import type { Milestone } from "@/types/milestone";
import type { Column, MilestoneRow } from "../columns";

function mapMilestone(item: Milestone): MilestoneRow {
  return {
    id: Number(item.id),
    name: item.name,
    project: item.project ?? null,
    due_planned: item.due_planned ?? null,
    due_actual: item.due_actual ?? null,
    status: item.status ?? "Planned",
    deleted_at: item.deleted_at ?? null,
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function MilestoneArchiveContent() {
  const { state, can } = useAuth();
  const authLoading = !state.isInitialized || state.isLoading;
  const canAccessArchive = can("melihat milestones") && can("menghapus milestones");
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("project_id") || undefined;
  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [paginationMeta, setPaginationMeta] = useState<ArchivePaginationMeta | null>(null);
  const [restoreLoadingId, setRestoreLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function fetchArchived() {
    setLoading(true);
    setError(null);
    try {
      const pageResult = await listArchived({ project_id: projectId, page, per_page: rowsPerPage });
      setRows(pageResult.data.map(mapMilestone));
      setPaginationMeta(pageResult.meta);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Gagal memuat milestone archive";
      setRows([]);
      setPaginationMeta(null);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function restoreMilestone(row: MilestoneRow) {
    setRestoreLoadingId(row.id);
    try {
      await restore(row.id);
      showToast({
        variant: "success",
        title: "Milestone restored",
        description: `Milestone "${row.name}" dikembalikan ke daftar aktif.`,
      });
      await fetchArchived();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "Gagal restore milestone";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal restore milestone",
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
  }, [authLoading, canAccessArchive, projectId, page, rowsPerPage]);

  function handleRowsPerPageChange(next: number) {
    setRowsPerPage(next);
    setPage(1);
  }

  const columns = useMemo<Column<MilestoneRow>[]>(() => [
    {
      key: "name",
      header: "Milestone",
      className: "min-w-[220px]",
      render: (row) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{row.name}</div>
          <div className="text-xs text-slate-400">{row.project?.name ?? "-"}</div>
        </div>
      ),
    },
    { key: "status", header: "Status", align: "center" },
    { key: "due_planned", header: "Due Planned", render: (row) => row.due_planned ?? "-" },
    { key: "due_actual", header: "Due Actual", render: (row) => row.due_actual ?? "-" },
    { key: "deleted_at", header: "Archived At", className: "min-w-[170px]", render: (row) => formatDateTime(row.deleted_at) },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => restoreMilestone(row)}
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

  const backHref = projectId ? `/dashboard/projects/${projectId}/milestones` : "/dashboard/milestones";

  return (
    <div className="space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
            <Link href={backHref} className="inline-flex items-center gap-1 transition hover:text-[#00674F]">
              <ChevronLeft className="h-4 w-4" />
              Milestones
            </Link>
          </div>
          <h1 className="text-3xl font-semibold text-slate-900">Milestone Archive</h1>
          <p className="mt-1 text-sm text-slate-500">Milestone yang sudah di-archive akan muncul di sini.</p>
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
        emptyText="Belum ada milestone archive."
      />

      {paginationMeta && (
        <ArchivePagination
          meta={paginationMeta}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

export default function MilestoneArchivePage() {
  return (
    <Suspense fallback={<div className="px-6 py-8 text-sm text-slate-500">Loading archive...</div>}>
      <MilestoneArchiveContent />
    </Suspense>
  );
}
