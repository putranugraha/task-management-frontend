"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Archive, SlidersHorizontal, X, Plus } from "lucide-react";
import { apiRequest } from "@/lib/api";
import type { Milestone } from "@/types/milestone";
import DataTable from "../users/data-table";
import { useMilestoneColumns, type MilestoneRow } from "./columns";
import { Skeleton } from "@/components/ui/skeleton";
import MilestoneStatsRow from "@/components/dashboard/MilestoneStatsRow";
import { RowsPerPageControl } from "@/components/dashboard/RowsPerPageControl";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

type PaginationMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

type PaginatedResponse<T> = {
  data: T[];
  meta?: PaginationMeta;
};

function MilestonesPageContent() {
  const { can } = useAuth();
  const canCreateProject = can("membuat project");
  const canUpdateProject = can("mengubah project");
  const canDeleteProject = can("menghapus project");

  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  const { showToast } = useToast();
  const [archiveTarget, setArchiveTarget] = useState<MilestoneRow | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<{ total: number; completed: number; overdue: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchMilestones = async (opts?: { page?: number; perPage?: number; search?: string }) => {
    const pageParam = opts?.page ?? page ?? 1;
    const perPageParam = opts?.perPage ?? rowsPerPage ?? 10;
    const searchParam = opts?.search ?? search ?? "";
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("per_page", String(perPageParam));
      if (searchParam.trim()) {
        params.set("search", searchParam.trim());
      }
      const res = await apiRequest<MaybePaginated<Milestone>>("GET", `/api/milestones?${params.toString()}`);
      const isArray = Array.isArray(res);
      const list = isArray ? res : ((res as PaginatedResponse<Milestone>).data ?? []);
      const meta = !isArray && (res as PaginatedResponse<Milestone>).meta
        ? (res as PaginatedResponse<Milestone>).meta as PaginationMeta
        : null;
      const mapped: MilestoneRow[] = list.map((m: any) => ({
        id: m.id,
        name: m.name,
        project: m.project ? { id: m.project.id, name: m.project.name } : null,
        due_planned: m.due_planned ?? null,
        due_actual: m.due_actual ?? null,
        status: m.status ?? "Planned",
      }));
      setRows(mapped);
      setPaginationMeta(meta);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load milestones";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat milestones",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMilestoneStats = async () => {
    try {
      setStatsLoading(true);
      const res = await apiRequest<{ total: number; completed: number; overdue: number }>(
        "GET",
        "/api/milestones/stats"
      );
      setStats({
        total: res.total ?? 0,
        completed: res.completed ?? 0,
        overdue: res.overdue ?? 0,
      });
    } catch {
      // Biarkan stats tetap berasal dari rows jika request gagal
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchMilestones({ page: 1, perPage: rowsPerPage, search });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleArchive = (row: MilestoneRow) => {
    setArchiveTarget(row);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      await apiRequest("DELETE", `/api/milestones/${archiveTarget.id}`);
      await fetchMilestones({ page: 1, perPage: rowsPerPage, search });
      showToast({
        variant: "success",
        title: "Milestone di-archive",
        description: `Milestone "${archiveTarget.name}" berhasil dipindahkan ke archive.`,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal archive milestone";
      showToast({
        variant: "error",
        title: "Gagal archive milestone",
        description: msg,
      });
    }
    finally {
      setArchiveLoading(false);
      setArchiveTarget(null);
    }
  };

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<Milestone | null>(null);

  const openDetail = async (row: MilestoneRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiRequest<any>("GET", `/api/milestones/${row.id}`);
      const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
      const m: any = Array.isArray(payload) ? payload[0] : payload;
      setDetailData({
        id: Number(m.id),
        project_id: Number(m.project_id ?? m.project?.id ?? 0),
        name: m.name,
        due_planned: m.due_planned ?? null,
        due_actual: m.due_actual ?? null,
        status: m.status ?? 'Planned',
        project: m.project ? { id: Number(m.project.id), name: m.project.name } : null,
        created_at: m.created_at,
        updated_at: m.updated_at,
      } as Milestone);
    } catch (e: any) {
      setDetailError(e?.message ?? "Gagal memuat detail milestone");
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = useMilestoneColumns({
    onDelete: handleArchive,
    onDetail: openDetail,
    canEdit: canUpdateProject,
    canDelete: canDeleteProject,
  });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detailOpen]);

  // Column toggle menu outside click
  useEffect(() => {
    if (!columnMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!columnMenuRef.current) return;
      if (!columnMenuRef.current.contains(event.target as Node)) {
        setColumnMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [columnMenuOpen]);

  const milestoneStats = useMemo(() => {
    const totalFromRows = rows.length;
    let completedFromRows = 0;
    let overdueFromRows = 0;
    rows.forEach((r) => {
      const s = (r.status || "").toLowerCase();
      if (s.includes("completed") || s === "complete") completedFromRows += 1;
      if (s.includes("overdue")) overdueFromRows += 1;
    });

    const total = stats?.total ?? totalFromRows;
    const completed = stats?.completed ?? completedFromRows;
    const overdue = stats?.overdue ?? overdueFromRows;

    const base = total || totalFromRows || 1;
    const completedPercent = Math.round((completed / base) * 100);
    const overduePercent = Math.round((overdue / base) * 100);
    const totalPercent = completedPercent;

    return { total, completed, overdue, totalPercent, completedPercent, overduePercent };
  }, [rows, stats]);

  // Column visibility logic (similar to Users page)
  const togglableColumns = useMemo(() => columns.filter((c) => c.key !== "actions"), [columns]);
  const columnOrder = useMemo(() => togglableColumns.map((c) => String(c.key)), [togglableColumns]);
  const defaultVisibleKeys = useMemo(() => {
    const preferred = new Set(["name", "project", "status"]);
    const picked = columnOrder.filter((key) => preferred.has(key));
    return picked.length > 0 ? picked : columnOrder;
  }, [columnOrder]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(defaultVisibleKeys);
  useEffect(() => {
    const valid = new Set(columnOrder);
    setVisibleKeys((prev) => {
      const filtered = prev.filter((key) => valid.has(key));
      if (filtered.length === prev.length && filtered.every((key, idx) => key === prev[idx])) {
        return prev;
      }
      if (filtered.length === 0) {
        return defaultVisibleKeys;
      }
      return filtered;
    });
  }, [columnOrder, defaultVisibleKeys]);

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const orderIndex = columnOrder.indexOf(key);
      if (orderIndex === -1) return prev;
      const set = new Set(prev);
      if (set.has(key)) {
        if (set.size === 1) return prev; // keep at least one column
        set.delete(key);
      } else {
        set.add(key);
      }
      const sorted = columnOrder.filter((k) => set.has(k));
      return sorted.length ? sorted : prev;
    });
  };

  // Server-side pagination + search
  useEffect(() => {
    fetchMilestones({ page, perPage: rowsPerPage, search });
  }, [page, rowsPerPage, search]);

  // Initial stats load (sekali saat mount, tidak ikut search)
  useEffect(() => {
    fetchMilestoneStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = paginationMeta && typeof paginationMeta.last_page === "number" && paginationMeta.last_page > 0
    ? paginationMeta.last_page
    : 1;
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const startIndex = paginationMeta && typeof paginationMeta.from === "number" && paginationMeta.from !== null
    ? Math.max(0, paginationMeta.from - 1)
    : (page - 1) * rowsPerPage;

  const totalItems = paginationMeta && typeof paginationMeta.total === "number"
    ? paginationMeta.total
    : rows.length;
  const summaryStart = totalItems === 0 ? 0 : (paginationMeta?.from ?? (startIndex + 1));
  const summaryEnd = totalItems === 0 ? 0 : (paginationMeta?.to ?? (startIndex + rows.length));

  const numberColumn: any = useMemo(() => ({
    key: "__number",
    header: "No",
    align: "center",
    className: "w-[80px]",
    render: (_row: MilestoneRow, index: number) => (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
        {startIndex + index + 1}
      </span>
    ),
  }), [startIndex]);

  const visibleColumns = useMemo(() => {
    const set = new Set(visibleKeys);
    const orderedVisible = columnOrder.filter((key) => set.has(key));
    return [
      numberColumn,
      ...orderedVisible.map((key) => columns.find((c) => String(c.key) === key)).filter(Boolean) as any[],
      ...columns.filter((c) => c.key === "actions"),
    ];
  }, [columns, numberColumn, visibleKeys, columnOrder]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Milestones Dashboard</h1>
        <p className="text-sm text-slate-500">Track milestone progress across projects and timelines.</p>
      </div>

      <MilestoneStatsRow stats={milestoneStats} loading={loading || statsLoading} />

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
        <div className="grid grid-cols-1 gap-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-6 md:grid-cols-2 md:items-center">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">Quick Search</span>
            <div className="relative flex h-12 w-full items-center overflow-hidden rounded-xl border border-transparent bg-white/90 shadow-[0_15px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition focus-within:ring-2 focus-within:ring-[#00674F] md:max-w-md">
              <span className="pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-[#00674F]/10 text-[#00674F]">
                <MagnifyingGlassIcon className="h-4 w-4" />
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type a name, project, or status…"
                className="h-full w-full rounded-xl border-0 bg-transparent pl-12 pr-24 text-sm font-medium text-slate-600 outline-none placeholder:text-slate-300"
              />
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#00674F]/10 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#00674F] transition hover:bg-[#00674F]/20"
              >
                Reset
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3" ref={columnMenuRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setColumnMenuOpen((v) => !v)}
                className="group inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition hover:border-[#00674F] hover:text-[#00674F]"
                aria-haspopup="menu"
                aria-expanded={columnMenuOpen}
              >
                <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-slate-50 text-slate-400 transition group-hover:bg-[#00674F]/10 group-hover:text-[#00674F]">
                  <span className="absolute inset-0 rounded-lg border border-white/40" />
                  <SlidersHorizontal className="h-[18px] w-[18px]" />
                </span>
                Manage Columns
              </button>
              {columnMenuOpen && (
                <div className="absolute right-0 z-30 mt-3 w-60 rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-[0_18px_36px_rgba(15,23,42,0.14)] ring-1 ring-slate-100">
                  <p className="px-1 pb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
                    Visible Columns
                  </p>
                  <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
                    {togglableColumns.map((col) => {
                      const key = String(col.key);
                      const checked = visibleKeys.includes(key);
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50/0 px-3 py-2 text-slate-600 transition hover:bg-slate-50/90"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-[#00674F] focus:ring-[#008061]"
                            checked={checked}
                            onChange={() => toggleColumn(key)}
                          />
                          <span className="flex-1 truncate text-sm font-medium">{col.header}</span>
                          <span className="text-[10px] uppercase tracking-[0.3em] text-slate-300">
                            {checked ? "On" : "Off"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {canDeleteProject && (
              <Link
                href="/dashboard/milestones/archive"
                className="group inline-flex h-12 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition hover:border-[#00674F] hover:text-[#00674F]"
              >
                <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-slate-50 text-slate-400 transition group-hover:bg-[#00674F]/10 group-hover:text-[#00674F]">
                  <span className="absolute inset-0 rounded-lg border border-white/40" />
                  <Archive className="h-[18px] w-[18px]" />
                </span>
                Archive
              </Link>
            )}
            {canCreateProject && (
              <Link
                href="/dashboard/milestones/create"
                className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
              >
                <Plus className="h-4 w-4" />
                Create Milestone
              </Link>
            )}
          </div>
        </div>

        <DataTable columns={visibleColumns as any} data={rows} loading={loading} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-5 text-sm text-slate-600">
          <span>
            Showing {summaryStart} to {summaryEnd} of {totalItems} milestone{totalItems === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <RowsPerPageControl
              value={rowsPerPage}
              onChange={(next) => {
                setRowsPerPage(next);
                setPage(1);
              }}
            />
            <div className="flex items-center gap-1 text-slate-500">
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold transition hover:border-blue-200 hover:text-blue-500 disabled:opacity-40"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                «
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold transition hover:border-blue-200 hover:text-blue-500 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ‹
              </button>
              <span className="px-3 text-sm font-semibold text-slate-500">Page {page} of {totalPages}</span>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold transition hover:border-blue-200 hover:text-blue-500 disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                ›
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold transition hover:border-blue-200 hover:text-blue-500 disabled:opacity-40"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {detailOpen && (
        (typeof document !== 'undefined') ? createPortal(
        <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-6">
          <div className="absolute inset-0 z-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
          <div className="relative z-10 mt-16 w-full max-w-5xl">
            <div className="rounded-3xl bg-white/95 shadow-[0_25px_45px_rgba(15,23,42,0.18)] ring-1 ring-slate-100 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Milestone Detail</h3>
                <div className="flex items-center gap-3">
                  {detailData && (
                    <>
                      {(detailData.project?.id || detailData.project_id) && (
                        <button
                          type="button"
                          onClick={() =>
                            (location.href = `/dashboard/projects/${detailData.project?.id ?? detailData.project_id}/milestones`)
                          }
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
                        >
                          View project milestones
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => (location.href = `/dashboard/milestones/${detailData.id}`)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
                      >
                        Open milestone page
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
                </div>
              </div>
              <div className="grid gap-8 p-6 lg:grid-cols-[0.9fr_1.1fr]">
                <aside className="flex h-full flex-col gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
                  {detailLoading ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Skeleton className="h-5 w-40 rounded" />
                        <Skeleton className="h-4 w-48 rounded" />
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-6 w-24 rounded-full" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                    </div>
                  ) : detailData ? (
                    <div className="space-y-4">
                      <div className="min-w-0">
                        <div className="text-xl font-semibold text-white">{detailData.name}</div>
                        <div className="mt-1 text-sm text-white/80">
                          {detailData.project?.name ?? 'No project'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                          {detailData.status}
                        </span>
                        {detailData.due_planned && (
                          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                            Due: {detailData.due_planned}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : null}
                </aside>
                <div className="grid gap-5">
                  {detailLoading ? (
                    <div className="grid gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-11 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : detailData ? (
                    <div className="grid gap-3">
                      <Row label="Project" value={detailData.project?.name ?? '-'} />
                      <Row label="Status" value={detailData.status ?? '-'} />
                      <Row label="Due Planned" value={detailData.due_planned ?? '-'} />
                      <Row label="Due Actual" value={detailData.due_actual ?? '-'} />
                      <Row label="Created At" value={detailData.created_at ?? '-'} />
                      <Row label="Updated At" value={detailData.updated_at ?? '-'} />
                      {detailError && (
                        <div className="text-sm text-red-600">{detailError}</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>, document.body) : null
      )}

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive milestone ini?"
        description={archiveTarget ? `Milestone "${archiveTarget.name}" akan dipindahkan ke archive dan bisa di-restore nanti.` : ""}
        confirmLabel="Archive"
        cancelLabel="Batal"
        variant="danger"
        loading={archiveLoading}
        onConfirm={confirmArchive}
        onCancel={() => !archiveLoading && setArchiveTarget(null)}
      />
    </div>
  );
}

export default function MilestonesPage() {
  const { loading, allowed } = usePermissionGuard(["melihat project"]);

  if (!loading && !allowed) {
    return <Forbidden />;
  }

  if (loading) {
    return null;
  }

  return <MilestonesPageContent />;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-inner flex items-center">
        <span className="truncate w-full whitespace-nowrap">{value}</span>
      </div>
    </div>
  );
}
