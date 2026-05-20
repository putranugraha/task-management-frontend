"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, AlertCircle, X, ListChecks } from "lucide-react";
import { apiRequest } from "@/lib/api";
import type { Role } from "@/types/role";
import type { Column } from "./columns";
import { useRoleColumns, type RoleRow } from "./columns";
import DataTable from "../users/data-table";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Plus, SlidersHorizontal } from "lucide-react";
import { RowsPerPageControl } from "@/components/dashboard/RowsPerPageControl";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/contexts/auth-context";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

function RolesPageContent() {
  const { can, state } = useAuth();
  const canCreateRoles = can("membuat roles");
  const canUpdateRoles = can("mengubah roles");
  const canDeleteRoles = can("menghapus roles");

  const [rows, setRows] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();
  const [deactivateTarget, setDeactivateTarget] = useState<RoleRow | null>(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [activateLoadingId, setActivateLoadingId] = useState<number | null>(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MaybePaginated<Role>>("GET", "/api/roles");
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      const mapped: RoleRow[] = list.map((r: any) => {
        const rawStatus = r.status ?? r.is_active ?? r.active ?? r.enabled;
        const status = typeof rawStatus === 'string'
          ? rawStatus
          : (rawStatus === true || rawStatus === 1 || rawStatus === '1')
            ? 'Aktif'
            : (rawStatus === false || rawStatus === 0 || rawStatus === '0')
              ? 'Non Aktif'
              : 'Aktif';

        let permNames: string[] = [];
        const perms = r.permissions ?? r.permission_names ?? r.perms;
        if (Array.isArray(perms)) {
          permNames = perms.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
        } else if (perms && Array.isArray(perms.data)) {
          permNames = perms.data.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
        } else if (typeof perms === 'string') {
          permNames = perms.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        const permissions_count = typeof r.permissions_count === 'number'
          ? r.permissions_count
          : (Array.isArray(permNames) ? permNames.length : undefined);

        return {
          id: r.id,
          name: r.name,
          status,
          permissions: permNames,
          permissions_count,
          created_at: r.created_at,
        } as RoleRow;
      });
      setRows(mapped);

      const needDetails = mapped.filter((m) => !m.permissions || m.permissions.length === 0);
      if (needDetails.length > 0) {
        const results = await Promise.allSettled(
          needDetails.map((m) => apiRequest<any>("GET", `/api/roles/${m.id}`))
        );
        const byId: Record<number, string[]> = {};
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            const data = res.value && typeof res.value === 'object' && 'data' in res.value ? (res.value as any).data : res.value;
            const r = Array.isArray(data) ? data[0] : data;
            let permNames: string[] = [];
            const perms = r?.permissions ?? r?.permission_names ?? r?.perms;
            if (Array.isArray(perms)) {
              permNames = perms.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
            } else if (perms && Array.isArray(perms.data)) {
              permNames = perms.data.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
            } else if (typeof perms === 'string') {
              permNames = perms.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
            const id = needDetails[idx].id;
            byId[id] = permNames;
          }
        });
        if (Object.keys(byId).length > 0) {
          setRows((prev) => prev.map((row) => byId[row.id] ? { ...row, permissions: byId[row.id], permissions_count: byId[row.id].length } : row));
        }
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to load roles";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat roles",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleDeactivate = (row: RoleRow) => {
    setDeactivateTarget(row);
  };

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await apiRequest("DELETE", `/api/roles/${deactivateTarget.id}`);
      await fetchRoles();
      showToast({
        variant: "success",
        title: "Role dinonaktifkan",
        description: `Role ${deactivateTarget.name} berhasil dinonaktifkan.`,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menonaktifkan role";
      showToast({
        variant: "error",
        title: "Gagal menonaktifkan role",
        description: msg,
      });
    } finally {
      setDeactivateLoading(false);
      setDeactivateTarget(null);
    }
  };

  const handleActivate = async (row: RoleRow) => {
    setActivateLoadingId(Number(row.id));
    try {
      await apiRequest("PATCH", `/api/roles/${row.id}/activate`);
      await fetchRoles();
      showToast({
        variant: "success",
        title: "Role diaktifkan",
        description: `Role ${row.name} berhasil diaktifkan kembali.`,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal mengaktifkan role";
      showToast({
        variant: "error",
        title: "Gagal mengaktifkan role",
        description: msg,
      });
    } finally {
      setActivateLoadingId(null);
    }
  };

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<(RoleRow & { updated_at?: string | null; description?: string | null }) | null>(null);

  const openDetail = async (row: RoleRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiRequest<any>("GET", `/api/roles/${row.id}`);
      const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
      const r = Array.isArray(payload) ? payload[0] : payload;
      const rawStatus = r?.status ?? r?.is_active ?? r?.active ?? r?.enabled;
      const status = typeof rawStatus === 'string'
        ? rawStatus
        : (rawStatus === true || rawStatus === 1 || rawStatus === '1')
          ? 'Aktif'
          : (rawStatus === false || rawStatus === 0 || rawStatus === '0')
            ? 'Non Aktif'
            : 'Aktif';

      let permNames: string[] = [];
      const perms = r?.permissions ?? r?.permission_names ?? r?.perms;
      if (Array.isArray(perms)) {
        permNames = perms.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
      } else if (perms && Array.isArray(perms.data)) {
        permNames = perms.data.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
      } else if (typeof perms === 'string') {
        permNames = perms.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      setDetailData({
        id: Number(r.id),
        name: r.name,
        status,
        permissions: permNames,
        permissions_count: typeof r.permissions_count === 'number' ? r.permissions_count : permNames.length,
        created_at: r.created_at,
        updated_at: r.updated_at ?? null,
        description: r.description ?? null,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal memuat detail role";
      setDetailError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat detail role",
        description: msg,
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = useRoleColumns(handleDeactivate, {
    onDetail: openDetail,
    onActivate: handleActivate,
    activatingId: activateLoadingId,
    currentRoleNames: state.roles ?? [],
    canEdit: canUpdateRoles,
    canDelete: canDeleteRoles,
  }) as unknown as Column<RoleRow>[];

  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detailOpen]);

  // Search + columns toggle + pagination (match Users)
  const [search, setSearch] = useState("");
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const togglableColumns = useMemo(() => columns.filter((c) => c.key !== "actions"), [columns]);
  const columnOrder = useMemo(() => togglableColumns.map((c) => String(c.key)), [togglableColumns]);
  const defaultVisibleKeys = useMemo(() => {
    const preferred = new Set(["name", "status"]);
    const picked = columnOrder.filter((key) => preferred.has(key));
    return picked.length > 0 ? picked : columnOrder;
  }, [columnOrder]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(defaultVisibleKeys);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

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
    return rows.filter((row) => [row.name, row.status]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [rows, search]);

  useEffect(() => { setPage(1); }, [rowsPerPage, search, rows.length]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const startIndex = (page - 1) * rowsPerPage;
  const paginatedRows = useMemo(
    () => filteredRows.slice(startIndex, startIndex + rowsPerPage),
    [filteredRows, startIndex, rowsPerPage]
  );

  const stats = useMemo(() => {
    let active = 0, inactive = 0;
    rows.forEach((r) => {
      const val = String(r.status ?? '').toLowerCase();
      if (val.includes('non') || val.includes('inaktif') || val.includes('inactive')) inactive += 1; else active += 1;
    });
    const total = active + inactive;
    return { total, active, inactive };
  }, [rows]);

  const numberColumn: Column<RoleRow> = useMemo(() => ({
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
      ...orderedVisible
        .map((key) => columns.find((c) => String(c.key) === key))
        .filter(Boolean) as Column<RoleRow>[],
      ...columns.filter((c) => c.key === "actions"),
    ];
  }, [columns, numberColumn, visibleKeys, columnOrder]);

  const summaryStart = filteredRows.length === 0 ? 0 : startIndex + 1;
  const summaryEnd = filteredRows.length === 0 ? 0 : startIndex + paginatedRows.length;

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
        <h1 className="text-3xl font-semibold text-slate-900">Roles Dashboard</h1>
        <p className="text-sm text-slate-500">Kelola peran dan status akses.</p>
      </div>

      {/* Active / Inactive cards only */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Active */}
        <div className={`group flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] p-6 text-white shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.32em] text-white/70">ACTIVE</p>
              <div className="mt-4 text-4xl font-semibold">
                {loading ? (
                  <span className="inline-flex h-9 w-20 animate-pulse rounded-lg bg-white/30" />
                ) : (
                  <span className="tabular-nums">{stats.active}</span>
                )}
              </div>
            </div>
            <span className="rounded-xl bg-white/15 p-2 text-white">
              {/* same icon sizing as StatsRow */}
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"/><path d="M12 14c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z"/></svg>
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between text-xs font-semibold">
            <span className="text-white/70">Updated live</span>
            {loading ? (
              <span className="inline-flex h-4 w-14 animate-pulse rounded-full bg-white/30" />
            ) : (
              <span className="text-emerald-100">+{stats.total ? Math.round((stats.active/Math.max(1,stats.total))*100) : 0}%</span>
            )}
          </div>
        </div>
        {/* Inactive */}
        <div className={`group flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-[#F43F5E] to-[#E11D48] p-6 text-white shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.32em] text-white/70">INACTIVE</p>
              <div className="mt-4 text-4xl font-semibold">
                {loading ? (
                  <span className="inline-flex h-9 w-20 animate-pulse rounded-lg bg-white/30" />
                ) : (
                  <span className="tabular-nums">{stats.inactive}</span>
                )}
              </div>
            </div>
            <span className="rounded-xl bg-white/15 p-2 text-white">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0z"/><path d="M12 14c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z"/></svg>
            </span>
          </div>
          <div className="mt-6 flex items-center justify-between text-xs font-semibold">
            <span className="text-white/70">Updated live</span>
            {loading ? (
              <span className="inline-flex h-4 w-14 animate-pulse rounded-full bg-white/30" />
            ) : (
              <span className="text-rose-100">+{stats.total ? Math.round((stats.inactive/Math.max(1,stats.total))*100) : 0}%</span>
            )}
          </div>
        </div>
      </div>

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
                placeholder="Search role or status…"
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
            {canCreateRoles && (
              <Link
                href="/dashboard/roles/create"
                className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
              >
                <Plus className="h-4 w-4" />
                Create Role
              </Link>
            )}
          </div>
        </div>

        <DataTable columns={visibleColumns as Column<RoleRow>[]} data={paginatedRows} loading={loading} />

        <ConfirmDialog
          open={!!deactivateTarget}
          title="Nonaktifkan role ini?"
          description={deactivateTarget ? `Role "${deactivateTarget.name}" tidak akan memberi akses permission sampai diaktifkan kembali.` : ""}
          confirmLabel="Nonaktifkan"
          cancelLabel="Batal"
          variant="danger"
          loading={deactivateLoading}
          onConfirm={confirmDeactivate}
          onCancel={() => {
            if (deactivateLoading) return;
            setDeactivateTarget(null);
          }}
        />

        {detailOpen && (
          (typeof document !== 'undefined') ? createPortal(
            <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-6">
              <div className="absolute inset-0 z-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
              <div className="relative z-10 mt-16 w-full max-w-4xl">
                <div className="rounded-3xl bg-white/95 shadow-[0_25px_45px_rgba(15,23,42,0.18)] ring-1 ring-slate-100 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h3 className="text-lg font-semibold text-slate-900">Role Detail</h3>
                    <button type="button" onClick={() => setDetailOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100" aria-label="Close">
                      <X className="h-5 w-5 text-slate-500" />
                    </button>
                  </div>
                  <div className="grid gap-8 p-6 lg:grid-cols-[0.9fr_1.1fr]">
                    {/* Left summary */}
                    <aside className="flex h-full flex-col gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
                      {detailLoading ? (
                        <div className="space-y-4">
                          <div className="h-6 w-32 animate-pulse rounded bg-white/30" />
                          <div className="flex gap-2">
                            <div className="h-6 w-24 animate-pulse rounded-full bg-white/30" />
                            <div className="h-6 w-16 animate-pulse rounded-full bg-white/30" />
                          </div>
                        </div>
                      ) : detailError ? (
                        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-100 shadow-sm">{detailError}</div>
                      ) : detailData ? (
                        <div className="space-y-4">
                          <div className="text-xl font-semibold text-white">{detailData.name}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", (detailData.status ?? '').toLowerCase().includes('non') ? 'bg-rose-50 text-rose-500 ring-1 ring-rose-200' : 'bg-emerald-50 text-emerald-500 ring-1 ring-emerald-200'].join(' ')}>
                              <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/40" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                              </span>
                              {detailData.status}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                              <ListChecks className="mr-1 h-3.5 w-3.5" /> {detailData.permissions_count ?? 0} perms
                            </span>
                          </div>
                          {detailData.permissions && detailData.permissions.length > 0 && (
                            <div className="rounded-xl border border-emerald-500/20 bg-emerald-800/20 p-4 text-white/90 backdrop-blur-sm">
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-100/90">Permissions</p>
                              <div className="max-h-40 overflow-y-auto pr-1">
                                <div className="flex flex-wrap gap-2">
                                  {detailData.permissions.map((perm, idx) => (
                                    <span
                                      key={`${perm}-${idx}`}
                                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                                      title={perm}
                                    >
                                      <ListChecks className="h-3.5 w-3.5" />
                                      <span className="truncate max-w-[180px] md:max-w-[220px]">
                                        {perm}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                          {detailData.description && (
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
                              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Description</p>
                              <p className="text-sm leading-relaxed">{detailData.description}</p>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </aside>

                    {/* Right details */}
                    <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
                      {detailLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                          {[...Array(6)].map((_, i) => (
                            <div key={i} className="space-y-2">
                              <div className="h-3 w-20 rounded bg-neutral-200/70" />
                              <div className="h-11 w-full rounded-xl bg-neutral-200/50" />
                            </div>
                          ))}
                        </div>
                      ) : detailError ? (
                        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{detailError}</div>
                      ) : detailData ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                          <Row label="Name" value={detailData.name} />
                          <Row label="Status" value={detailData.status ?? '-'} />
                          <Row label="Permissions" value={detailData.permissions?.length ? detailData.permissions.join(', ') : '-'} />
                          <Row label="Permissions Count" value={String(detailData.permissions_count ?? 0)} />
                          <Row label="Created At" value={detailData.created_at ?? '-'} />
                          <Row label="Updated At" value={detailData.updated_at ?? '-'} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>, document.body) : null
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-5 text-sm text-slate-600">
          <span>
            Showing {summaryStart} to {summaryEnd} of {filteredRows.length} role{filteredRows.length === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <RowsPerPageControl
              value={rowsPerPage}
              onChange={(next) => setRowsPerPage(next)}
            />
            <div className="flex items-center gap-1 text-slate-500">
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold transition hover:border-blue-200 hover:text-blue-500 disabled:opacity-40" onClick={() => setPage(1)} disabled={page === 1}>«</button>
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold transition hover:border-blue-200 hover:text-blue-500 disabled:opacity-40" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
              <span className="px-3 text-sm font-semibold text-slate-500">Page {page} of {totalPages}</span>
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold transition hover:border-blue-200 hover:text-blue-500 disabled:opacity-40" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
              <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold transition hover:border-blue-200 hover:text-blue-500 disabled:opacity-40" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
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

export default function RolesPage() {
  const { loading, allowed } = usePermissionGuard(["melihat roles"]);

  if (!loading && !allowed) {
    return <Forbidden />;
  }

  if (loading) {
    return null;
  }

  return <RolesPageContent />;
}
