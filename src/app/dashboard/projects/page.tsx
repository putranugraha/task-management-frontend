"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import DataTable from "../users/data-table";
import { useProjectColumns, type ProjectRow, type Column } from "./columns";
import ProjectStatsRow from "@/components/dashboard/ProjectStatsRow";
import { RowsPerPageControl } from "@/components/dashboard/RowsPerPageControl";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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

const DEFAULT_PER_PAGE = 10;

export default function ProjectsPage() {
  const { can } = useAuth();
  const canManageProject = can("mengelola project");

  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta | null>(null);
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<ProjectRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PER_PAGE);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<{ total: number; active: number; completed: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchProjects = async (opts?: { page?: number; perPage?: number; search?: string }) => {
    const pageParam = opts?.page ?? page ?? 1;
    const perPageParam = opts?.perPage ?? rowsPerPage ?? DEFAULT_PER_PAGE;
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
      const res = await apiRequest<MaybePaginated<Project>>("GET", `/api/projects?${params.toString()}`);
      const isArray = Array.isArray(res);
      const list = isArray ? res : ((res as PaginatedResponse<Project>).data ?? []);
      const meta = !isArray && (res as PaginatedResponse<Project>).meta
        ? (res as PaginatedResponse<Project>).meta as PaginationMeta
        : null;
      const mapped: ProjectRow[] = list.map((p: any) => {
        const owner = p.division_owner || p.owner || p.project_owner || null;
        const ownerObj = owner
          ? { id: Number(owner.id ?? owner.user_id ?? 0), name: owner.name ?? owner.full_name ?? owner.email ?? 'Unknown' }
          : null;
        return {
          id: Number(p.id),
          name: p.name,
          client_name: p.client_name ?? p.client ?? '-',
          value_amount: typeof p.value_amount === 'string' ? p.value_amount : Number(p.value_amount ?? 0),
          status: p.status ?? 'Planned',
          division_owner: ownerObj,
          start_planned: p.start_planned ?? null,
          end_planned: p.end_planned ?? null,
          created_at: p.created_at,
        } as ProjectRow;
      });
      setRows(mapped);
      setPaginationMeta(meta);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load projects";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat projects",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectStats = async (opts?: { search?: string }) => {
    const searchParam = opts?.search ?? search ?? "";
    try {
      setStatsLoading(true);
      const params = new URLSearchParams();
      if (searchParam.trim()) {
        params.set("search", searchParam.trim());
      }
      const res = await apiRequest<{ total: number; active: number; completed: number }>(
        "GET",
        `/api/projects/stats?${params.toString()}`
      );
      setStats({
        total: res.total ?? 0,
        active: res.active ?? 0,
        completed: res.completed ?? 0,
      });
    } catch {
      // Jika gagal, biarkan stats tetap nilai sebelumnya agar kartu tidak kosong
    } finally {
      setStatsLoading(false);
    }
  };

  // Debounce search input to avoid refetch on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(handle);
  }, [search]);

  // Initial stats load (sekali saat mount, tidak ikut search)
  useEffect(() => {
    fetchProjectStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = (row: ProjectRow) => {
    setDeleteTarget(row);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiRequest("DELETE", `/api/projects/${deleteTarget.id}`);
      await fetchProjects();
      showToast({
        variant: "success",
        title: "Project dihapus",
        description: `Project "${deleteTarget.name}" berhasil dihapus.`,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menghapus project";
      showToast({
        variant: "error",
        title: "Gagal menghapus project",
        description: msg,
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const baseColumns = useProjectColumns(handleDelete, {
    minimal: true,
    canManage: canManageProject,
  }) as unknown as Column<ProjectRow>[];

  // Column visibility controls, mirroring Users page
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const togglableColumns = useMemo(() => baseColumns.filter((c) => c.key !== "actions"), [baseColumns]);
  const columnOrder = useMemo(() => togglableColumns.map((c) => String(c.key)), [togglableColumns]);
  const defaultVisibleKeys = useMemo(() => {
    const preferred = new Set(["name", "status", "start_planned", "end_planned"]);
    const picked = columnOrder.filter((key) => preferred.has(key));
    return picked.length > 0 ? picked : columnOrder;
  }, [columnOrder]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(defaultVisibleKeys);

  useEffect(() => {
    const valid = new Set(columnOrder);
    setVisibleKeys((prev) => {
      const filtered = prev.filter((key) => valid.has(key));
      if (filtered.length === prev.length && filtered.every((k, i) => k === prev[i])) return prev;
      if (filtered.length === 0) return defaultVisibleKeys;
      return filtered;
    });
  }, [columnOrder, defaultVisibleKeys]);

  useEffect(() => {
    if (!columnMenuOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!columnMenuRef.current) return;
      if (!columnMenuRef.current.contains(event.target as Node)) setColumnMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [columnMenuOpen]);

  // Server-side pagination + search
  useEffect(() => {
    fetchProjects({ page, perPage: rowsPerPage, search: debouncedSearch });
  }, [page, rowsPerPage, debouncedSearch]);

  const totalPages = paginationMeta && typeof paginationMeta.last_page === "number" && paginationMeta.last_page > 0
    ? paginationMeta.last_page
    : 1;
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = paginationMeta && typeof paginationMeta.from === "number" && paginationMeta.from !== null
    ? Math.max(0, paginationMeta.from - 1)
    : (page - 1) * rowsPerPage;

  const numberColumn: Column<ProjectRow> = useMemo(() => ({
    key: "__number",
    header: "No",
    align: "center",
    className: "w-[80px]",
    render: (_row, index) => (
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
      ...orderedVisible.map((key) => baseColumns.find((c) => String(c.key) === key)).filter(Boolean) as Column<ProjectRow>[],
      ...baseColumns.filter((c) => c.key === "actions"),
    ];
  }, [baseColumns, numberColumn, visibleKeys, columnOrder]);

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

  const totalItems = paginationMeta && typeof paginationMeta.total === "number"
    ? paginationMeta.total
    : rows.length;
  const summaryStart = totalItems === 0 ? 0 : (paginationMeta?.from ?? (startIndex + 1));
  const summaryEnd = totalItems === 0 ? 0 : (paginationMeta?.to ?? (startIndex + rows.length));

  // Project stats (3 cards max)
  const projectStats = useMemo(() => {
    const total = stats?.total ?? totalItems;
    const active = stats?.active ?? 0;
    const completed = stats?.completed ?? 0;
    const baseForPercent = total || rows.length || 1;
    const activePercent = Math.round((active / baseForPercent) * 100);
    const completedPercent = Math.round((completed / baseForPercent) * 100);
    return {
      total,
      active,
      completed,
      totalPercent: activePercent,
      activePercent,
      completedPercent,
    };
  }, [stats, totalItems, rows.length]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Projects Dashboard</h1>
        <p className="text-sm text-slate-500">Keep projects aligned and moving forward.</p>
      </div>

      <ProjectStatsRow stats={projectStats as any} loading={loading || statsLoading} />

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
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Type project, client, or status…"
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
                  <p className="px-1 pb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">Visible Columns</p>
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
                          <span className="text-[10px] uppercase tracking-[0.3em] text-slate-300">{checked ? "On" : "Off"}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {canManageProject && (
              <Link
                href="/dashboard/projects/create"
                className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
              >
                <Plus className="h-4 w-4" />
                Create Project
              </Link>
            )}
          </div>
        </div>

        <DataTable columns={visibleColumns as Column<ProjectRow>[]} data={rows} loading={loading} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-5 text-sm text-slate-600">
          <span>
            Showing {summaryStart} to {summaryEnd} of {totalItems} project{totalItems === 1 ? "" : "s"}
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus project ini?"
        description={deleteTarget ? `Project "${deleteTarget.name}" akan dihapus dari sistem.` : ""}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
      />
    </div>
  );
}
