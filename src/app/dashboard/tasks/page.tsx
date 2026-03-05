"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { apiRequest } from "@/lib/api";
import type { Task } from "@/types/task";
import type { StatusHistory } from "@/types/status-history";
import { listByTask as listStatusHistories } from "@/lib/api/status-histories";
import { useTaskColumns, type TaskRow } from "./columns";
import type { Column } from "../users/columns";
import TaskStatsRow from "@/components/dashboard/TaskStatsRow";
import { RowsPerPageControl } from "@/components/dashboard/RowsPerPageControl";
import { Skeleton } from "@/components/ui/skeleton";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { SlidersHorizontal, AlertCircle, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Simple in-memory cache for task list to avoid refetching on every navigation.
// This lives for the lifetime of the JS bundle (per tab) and is safe for dashboard use.
let tasksCache: { rows: TaskRow[]; fetchedAt: number } | null = null;
const TASKS_CACHE_TTL_MS = 60_000; // 60 seconds

const DataTable = dynamic(
  () => import("../users/data-table"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-[320px] w-full rounded-2xl" />
      </div>
    ),
  }
);

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

type MaybePaginated<T> = T[] | PaginatedResponse<T>;

const DEFAULT_PER_PAGE = 10;

export default function TasksPage() {
  const { can } = useAuth();
  const canManageTasks = can("mengelola tugas");
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null);
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<TaskRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [stats, setStats] = useState<{ total: number; completed: number; in_progress: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchTasks = async (opts?: { page?: number; perPage?: number; showLoading?: boolean }) => {
    const showLoading = opts?.showLoading ?? true;
    const pageParam = opts?.page ?? 1;
    const perPageParam = opts?.perPage ?? DEFAULT_PER_PAGE;
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("per_page", String(perPageParam));
      const res = await apiRequest<MaybePaginated<Task>>("GET", `/api/tasks?${params.toString()}`);
      const isArray = Array.isArray(res);
      const list = isArray ? res : ((res as PaginatedResponse<Task>).data ?? []);
      const meta = !isArray && (res as PaginatedResponse<Task>).meta ? (res as PaginatedResponse<Task>).meta as PaginationMeta : null;
      const mapped: TaskRow[] = list.map((t: any) => ({
        id: Number(t.id),
        title: t.title,
        project: t.project ? { id: Number(t.project.id), name: t.project.name } : null,
        priority: t.priority ?? "Medium",
        status: t.status ?? "To Do",
        start_planned: t.start_planned ?? null,
        end_planned: t.end_planned ?? null,
        percent_complete: Number(t.percent_complete ?? 0),
      }));
      const dedupedMap = new Map<number, TaskRow>();
      for (const row of mapped) {
        if (!Number.isFinite(row.id)) continue;
        dedupedMap.set(row.id, row);
      }
      const deduped = Array.from(dedupedMap.values());
      setRows(deduped);
      setPaginationMeta(meta);
      if (pageParam === 1) {
        tasksCache = { rows: deduped, fetchedAt: Date.now() };
      }
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load tasks";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat tasks",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTaskStats = async () => {
    try {
      setStatsLoading(true);
      const res = await apiRequest<{ total: number; completed: number; in_progress: number }>(
        "GET",
        "/api/tasks/stats"
      );
      setStats({
        total: res.total ?? 0,
        completed: res.completed ?? 0,
        in_progress: res.in_progress ?? 0,
      });
    } catch {
      // Biarkan stats tetap dihitung dari rows jika request gagal
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (tasksCache) {
      const age = Date.now() - tasksCache.fetchedAt;
      if (age >= 0 && age <= TASKS_CACHE_TTL_MS) {
        setRows(tasksCache.rows);
      }
    }
  }, []);

  const handleDelete = (row: TaskRow) => {
    setDeleteTarget(row);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiRequest("DELETE", `/api/tasks/${deleteTarget.id}`);
      await fetchTasks({ page: 1, perPage: DEFAULT_PER_PAGE, showLoading: false });
      showToast({
        variant: "success",
        title: "Task dihapus",
        description: `Task "${deleteTarget.title}" berhasil dihapus.`,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menghapus task";
      showToast({
        variant: "error",
        title: "Gagal menghapus task",
        description: msg,
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  // Detail modal state (consistent with Users)
  const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [detailData, setDetailData] = useState<
      (TaskRow & {
        description?: string | null;
        created_at?: string | null;
        updated_at?: string | null;
        start_actual?: string | null;
        end_actual?: string | null;
        milestone?: { id: number; name: string } | null;
        assignees?: { id: number; name: string }[];
      }) | null
    >(null);
    const [statusHistories, setStatusHistories] = useState<StatusHistory[]>([]);
    const [statusHistLoading, setStatusHistLoading] = useState(false);
    const [statusHistError, setStatusHistError] = useState<string | null>(null);

    const openDetail = async (row: TaskRow) => {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailError(null);
      setStatusHistories([]);
      setStatusHistError(null);
      setStatusHistLoading(true);
      try {
      // Try includes for richer payloads when backend supports it
      const baseUrl = `/api/tasks/${row.id}`;
      const endpoints = [
        `${baseUrl}?include=project,milestone,assignments,users,dependencies,dependents`,
        `${baseUrl}?include=project,milestone`,
        baseUrl,
      ];
      let payload: any = null;
      for (const ep of endpoints) {
        try {
          const res = await apiRequest<any>("GET", ep);
          const data = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
          payload = Array.isArray(data) ? data[0] : data;
          break;
        } catch (e: any) {
          if (e?.response?.status === 404) continue;
          throw e;
        }
      }
      if (!payload) throw new Error("Task not found");
      // Map potential assignees from assignments/users collection
      let assignees: { id: number; name: string }[] = [];
      const assignments = Array.isArray(payload?.assignments) ? payload.assignments : [];
      for (const a of assignments) {
        const uid = Number((a?.user?.id ?? a?.user_id ?? NaN));
        const nm = a?.user?.name ?? undefined;
        if (!Number.isNaN(uid) && nm) assignees.push({ id: uid, name: nm });
      }
      if (assignees.length === 0 && Array.isArray(payload?.users)) {
        for (const u of payload.users) {
          const uid = Number(u?.id ?? NaN);
          const nm = u?.name ?? undefined;
          if (!Number.isNaN(uid) && nm) assignees.push({ id: uid, name: nm });
        }
      }

        setDetailData({
          id: Number(payload.id),
          title: payload.title,
          project: payload.project ? { id: Number(payload.project.id), name: payload.project.name } : null,
        priority: payload.priority ?? 'Medium',
        status: payload.status ?? 'To Do',
        start_planned: payload.start_planned ?? null,
        end_planned: payload.end_planned ?? null,
        percent_complete: Number(payload.percent_complete ?? 0),
        description: payload.description ?? null,
        start_actual: payload.start_actual ?? null,
        end_actual: payload.end_actual ?? null,
        created_at: payload.created_at ?? null,
        updated_at: payload.updated_at ?? null,
        milestone: payload.milestone ? { id: Number(payload.milestone.id), name: payload.milestone.name } : null,
          assignees,
        });

        try {
          const histories = await listStatusHistories(row.id, { perPage: 10 });
          setStatusHistories(histories);
        } catch (e: any) {
          const msg = e?.message ?? "Gagal memuat histori status";
          setStatusHistError(msg);
          showToast({
            variant: "error",
            title: "Gagal memuat histori status",
            description: msg,
          });
        }
      } catch (e: any) {
        const msg = e?.message ?? "Gagal memuat detail task";
        setDetailError(msg);
        showToast({
          variant: "error",
          title: "Gagal memuat detail task",
          description: msg,
        });
      } finally {
        setDetailLoading(false);
        setStatusHistLoading(false);
      }
    };

  // Columns
  const columns = useTaskColumns(handleDelete, {
    onDetail: openDetail,
    canManage: canManageTasks,
  });

  // Column menu + search + pagination (mirror from Users)
  const [search, setSearch] = useState("");
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const togglableColumns = useMemo(() => columns.filter((c) => c.key !== "actions"), [columns]);
  const columnOrder = useMemo(() => togglableColumns.map((c) => String(c.key)), [togglableColumns]);
  const defaultVisibleKeys = useMemo(() => {
    const preferred = new Set(["title", "project", "status"]);
    const picked = columnOrder.filter((key) => preferred.has(key));
    return picked.length > 0 ? picked : columnOrder;
  }, [columnOrder]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(defaultVisibleKeys);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PER_PAGE);
  const [page, setPage] = useState(1);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchTasks({ page, perPage: rowsPerPage });
  }, [page, rowsPerPage]);

  // Initial stats load (sekali saat mount, tidak ikut search/pagination)
  useEffect(() => {
    fetchTaskStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const vals = [
        row.title,
        row.project?.name,
        row.status,
        row.priority,
      ].filter(Boolean) as string[];
      return vals.some((v) => String(v).toLowerCase().includes(term));
    });
  }, [rows, search]);

  useEffect(() => { setPage(1); }, [search]);
  const totalPages = paginationMeta && typeof paginationMeta.last_page === "number" && paginationMeta.last_page > 0
    ? paginationMeta.last_page
    : 1;
  const startIndex = paginationMeta && typeof paginationMeta.from === "number" && paginationMeta.from !== null
    ? Math.max(0, paginationMeta.from - 1)
    : (page - 1) * rowsPerPage;
  const paginatedRows = filteredRows;

  const taskStats = useMemo(() => {
    const totalFromRows = rows.length;
    let completedFromRows = 0;
    let inProgressFromRows = 0;
    rows.forEach((r) => {
      const s = (r.status || "").toLowerCase();
      const isCompleted = /(\b|^)(done|completed?)($|\b)/.test(s) && !s.includes("incomplete");
      const isInProgress = s.includes("in progress") || s === "progress" || s.includes("ongoing");
      if (isCompleted) completedFromRows += 1;
      else if (!s.includes("incomplete") && (s.includes("done") || s.includes("completed") || s === "complete")) {
        completedFromRows += 1;
      } else if (isInProgress) {
        inProgressFromRows += 1;
      }
    });
    const total = stats?.total ?? totalFromRows;
    const completed = stats?.completed ?? completedFromRows;
    const inProgress = stats?.in_progress ?? inProgressFromRows;
    const base = total || totalFromRows || 1;
    const completedPercent = Math.round((completed / base) * 100);
    const inProgressPercent = Math.round((inProgress / base) * 100);
    const totalPercent = completedPercent;
    return { total, completed, inProgress, totalPercent, completedPercent, inProgressPercent };
  }, [rows, stats]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detailOpen]);

  const numberColumn: Column<TaskRow> = useMemo(() => ({
    key: "__number",
    header: "No",
    align: "center",
    className: "w-[80px]",
    render: (_row, index) => (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
        {startIndex + (index ?? 0) + 1}
      </span>
    ),
  }), [startIndex]);

  const visibleColumns = useMemo(() => {
    const set = new Set(visibleKeys);
    const orderedVisible = columnOrder.filter((key) => set.has(key));
    return [
      numberColumn,
      ...orderedVisible
        .map((key) => columns.find((c) => String(c.key) === key))
        .filter(Boolean) as Column<TaskRow>[],
      ...columns.filter((c) => c.key === "actions"),
    ];
  }, [columns, numberColumn, visibleKeys, columnOrder]);

  const totalItems = paginationMeta && typeof paginationMeta.total === "number"
    ? paginationMeta.total
    : paginatedRows.length;
  const summaryStart = totalItems === 0 ? 0 : (paginationMeta?.from ?? (startIndex + 1));
  const summaryEnd = totalItems === 0 ? 0 : (paginationMeta?.to ?? (startIndex + paginatedRows.length));

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const orderIndex = columnOrder.indexOf(key);
      if (orderIndex === -1) return prev;
      const set = new Set(prev);
      if (set.has(key)) {
        if (set.size === 1) return prev;
        set.delete(key);
      } else {
        set.add(key);
      }
      const sorted = columnOrder.filter((k) => set.has(k));
      return sorted.length ? sorted : prev;
    });
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Tasks Dashboard</h1>
        <p className="text-sm text-slate-500">Monitor tasks by status and progress.</p>
      </div>

      <TaskStatsRow stats={taskStats as any} loading={loading || statsLoading} />

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{error}</div>
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
                placeholder="Type a title, project, status…"
                className="h-full w-full rounded-xl border-0 bg-transparent pl-12 pr-24 text-sm font-medium text-slate-600 outline-none placeholder:text-slate-300"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#00674F]/10 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#00674F] transition hover:bg-[#00674F]/20"
                >
                  Reset
                </button>
              )}
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
                  <p className="px-1 pb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Visible Columns</p>
                  <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
                    {togglableColumns.map((col) => {
                      const key = String(col.key);
                      const checked = visibleKeys.includes(key);
                      return (
                        <label key={key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                          <span className="text-slate-600">{col.header}</span>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColumn(key)}
                            className="h-4 w-4 rounded border-slate-300 text-[#00674F] focus:ring-[#00674F]"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {canManageTasks && (
              <Link
                href="/dashboard/tasks/create"
                className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
              >
                Create Task
              </Link>
            )}
          </div>
        </div>
        <div className="p-6">
          <DataTable columns={visibleColumns as any} data={paginatedRows} loading={loading} />
        </div>

        {/* Detail Modal (match Users) */}
        {(detailOpen && typeof document !== 'undefined') && createPortal(
          <div className="fixed inset-0 z-[1000]">
            <div className="fixed inset-0 z-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setDetailOpen(false)} />
            <div className="relative z-10 flex h-full w-full items-start justify-center overflow-y-auto p-6">
              <div className="relative z-10 mt-16 w-full max-w-5xl">
                <div className="overflow-hidden rounded-3xl bg-white/95 shadow-[0_25px_45px_rgba(15,23,42,0.18)] ring-1 ring-slate-100">
                  <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h3 className="text-lg font-semibold text-slate-900">Task Detail</h3>
                    <div className="flex items-center gap-3">
                      {detailData && (
                        <>
                          {detailData.project?.id && (
                            <button
                              type="button"
                              onClick={() =>
                                (location.href = `/dashboard/projects/${detailData.project?.id}/milestones`)
                              }
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
                            >
                              View project milestones
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => (location.href = `/dashboard/tasks/${detailData.id}`)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
                          >
                            Open task page
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
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-full bg-white/30 animate-pulse" />
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-40 rounded" />
                            <Skeleton className="h-3 w-48 rounded" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Skeleton className="h-6 w-28 rounded-full" />
                          <Skeleton className="h-6 w-24 rounded-full" />
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                      </div>
                    ) : detailData ? (
                      <div className="space-y-5">
                        <div className="flex items-center gap-4">
                          <div className="grid h-16 w-16 place-items-center rounded-full bg-white/20 text-lg font-bold">
                            {getInitials(detailData.title, detailData.project?.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xl font-semibold text-white">{detailData.title}</div>
                            {detailData.project?.name && (
                              <div className="mt-1 text-sm text-white/80">{detailData.project.name}</div>
                            )}
                          </div>
                        </div>
                        {detailData.description && (
                          <p className="text-sm text-white/80 line-clamp-2">{detailData.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          {detailData.status && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                              </span>
                              {detailData.status}
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                            Progress {detailData.percent_complete ?? 0}%
                          </span>
                          {detailData.priority && (
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                              {detailData.priority}
                            </span>
                          )}
                          {detailData.milestone?.name && (
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                              {detailData.milestone.name}
                            </span>
                          )}
                          {renderDueChip(detailData.end_planned)}
                        </div>
                        {detailData.assignees && detailData.assignees.length > 0 && (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-white/70 mb-2">Assignees</div>
                            <div className="flex flex-wrap items-center gap-2">
                              {detailData.assignees.slice(0, 5).map((a) => (
                                <span key={a.id} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">
                                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[10px] font-bold">
                                    {getInitials(a.name)}
                                  </span>
                                  {a.name}
                                </span>
                              ))}
                              {detailData.assignees.length > 5 && (
                                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">
                                  +{detailData.assignees.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {detailError ? (
                          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600 shadow-sm">{detailError}</div>
                        ) : null}
                      </div>
                    ) : null}
                  </aside>

                  <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
                    {detailLoading ? (
                      <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="space-y-2">
                            <Skeleton className="h-3 w-20 rounded" />
                            <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
                          </div>
                        ))}
                      </div>
                    ) : detailData ? (
                      <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                        <Row label="Title" value={detailData.title} />
                        <Row label="Project" value={detailData.project?.name ?? '-'} />
                        <Row label="Priority" value={detailData.priority ?? '-'} />
                        <Row label="Status" value={detailData.status ?? '-'} />
                        <Row label="Progress" value={`${detailData.percent_complete ?? 0}%`} />
                        <Row label="Start Planned" value={detailData.start_planned ?? '-'} />
                        <Row label="End Planned" value={detailData.end_planned ?? '-'} />
                        <Row label="Start Actual" value={detailData.start_actual ?? '-'} />
                        <Row label="End Actual" value={detailData.end_actual ?? '-'} />
                        <Row label="Created At" value={detailData.created_at ?? '-'} />
                        <Row label="Updated At" value={detailData.updated_at ?? '-'} />
                        <div className="md:col-span-2 space-y-4">
                          <Row label="Description" value={detailData.description ?? '-'} />
                          <div>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                              Status History
                            </div>
                            {statusHistLoading ? (
                              <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, idx) => (
                                  <Skeleton key={idx} className="h-10 w-full rounded-lg" />
                                ))}
                              </div>
                            ) : statusHistError ? (
                              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                                {statusHistError}
                              </div>
                            ) : statusHistories.length === 0 ? (
                              <div className="text-xs text-neutral-400">
                                Belum ada histori status untuk task ini.
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-56 overflow-y-auto rounded-xl border border-slate-100 bg-white px-3 py-2">
                                {statusHistories.map((h) => {
                                  const actor = h.changer?.name ?? "System";
                                  const fromLabel = h.from_status ?? "Tidak diketahui";
                                  const toLabel = h.to_status || "Tidak diketahui";
                                  const isStatusChange = h.from_status !== h.to_status;
                                  return (
                                    <div
                                      key={h.id}
                                      className="flex items-start justify-between gap-2 text-xs text-slate-700"
                                    >
                                      <div className="space-y-0.5">
                                        <div className="font-semibold">
                                          {isStatusChange ? (
                                            <>
                                              {actor} mengubah status dari{" "}
                                              <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold">
                                                {fromLabel}
                                              </span>
                                              {" "}menjadi{" "}
                                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                {toLabel}
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              {actor} memperbarui detail task{" "}
                                              <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold">
                                                Status: {toLabel}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                        {h.note && (
                                          <div className="text-[11px] text-slate-500">
                                            Catatan: {h.note}
                                          </div>
                                        )}
                                        <div className="text-[11px] text-slate-400">
                                          Task ID: {h.task_id}
                                        </div>
                                      </div>
                                      <div className="whitespace-nowrap text-[11px] text-slate-400">
                                        {h.created_at ? new Date(h.created_at).toLocaleString("id-ID") : ""}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : detailError ? (
                      <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{detailError}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>, document.body)}

        <ConfirmDialog
          open={!!deleteTarget}
          title="Hapus task ini?"
          description={deleteTarget ? `Task "${deleteTarget.title}" akan dihapus dari sistem.` : ""}
          confirmLabel="Hapus"
          cancelLabel="Batal"
          variant="danger"
          loading={deleteLoading}
          onConfirm={confirmDelete}
          onCancel={() => !deleteLoading && setDeleteTarget(null)}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-5 text-sm text-slate-600">
          <span>
            Showing {summaryStart} to {summaryEnd} of {totalItems} task{totalItems === 1 ? "" : "s"}
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
    </div>
  );
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

function getInitials(name?: string | null, fallback?: string | null) {
  const source = (name ?? fallback ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? "").join("").toUpperCase();
}

function renderDueChip(endPlanned?: string | null) {
  if (!endPlanned) return null;
  const end = Date.parse(endPlanned);
  if (!Number.isFinite(end)) return null;
  const now = new Date();
  const days = Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000));
  let text = "Due";
  let cls = "bg-white/10";
  if (days > 1) { text = `Due in ${days} days`; cls = "bg-white/10"; }
  else if (days === 1) { text = "Due tomorrow"; cls = "bg-white/10"; }
  else if (days === 0) { text = "Due today"; cls = "bg-amber-50 text-amber-700"; }
  else { text = `Overdue ${Math.abs(days)}d`; cls = "bg-rose-50 text-rose-600"; }
  return (
    <span className={["inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide", cls].join(" ")}>{text}</span>
  );
}
