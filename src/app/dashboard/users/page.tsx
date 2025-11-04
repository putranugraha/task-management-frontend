"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { User as UserType } from "@/types/user";
import DataTable from "./data-table";
import { useUserColumns, type Column, type UserRow } from "./columns";
import { Mail, ShieldCheck, AlertCircle, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Skeleton } from "@/components/ui/skeleton";
import StatsRow from "@/components/dashboard/StatsRow";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { Plus, SlidersHorizontal } from "lucide-react";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MaybePaginated<UserType>>("GET", "/api/users");
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      const mapped: UserRow[] = list.map((u: any) => {
        // Normalize role: support `role` string, `roles` array, or nested resources
        let role: string | null = (u as any).role ?? null;
        if (!role && Array.isArray((u as any).roles) && (u as any).roles.length) {
          const first = (u as any).roles[0];
          role = typeof first === 'string' ? first : (first?.name ?? null);
        }
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          job_title: (u as any).job_title ?? null,
          is_active: (u as any).is_active ?? true,
          status: (u as any).status ?? "Aktif",
          role,
          division: u.division ? { id: u.division.id, name: u.division.name } : null,
          created_at: (u as any).created_at,
        } as UserRow;
      });
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (row: UserRow) => {
    const ok = confirm(`Hapus user ${row.name}?`);
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/users/${row.id}`);
      await fetchUsers();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menghapus user");
    }
  };

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<(UserRow & { last_login_at?: string | null; email_verified_at?: string | null; updated_at?: string | null }) | null>(null);

  const openDetail = async (row: UserRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiRequest<any>("GET", `/api/users/${row.id}`);
      const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
      const u = Array.isArray(payload) ? payload[0] : payload;
      const role = u?.role ?? (Array.isArray(u?.roles) && u.roles.length ? (typeof u.roles[0] === 'string' ? u.roles[0] : u.roles[0]?.name) : null);
      setDetailData({
        id: Number(u.id),
        name: u.name,
        email: u.email,
        role,
        job_title: u.job_title ?? null,
        is_active: Boolean(u.is_active ?? true),
        status: u.status ?? 'Aktif',
        division: u.division ? { id: Number(u.division.id), name: u.division.name } : null,
        created_at: u.created_at,
        updated_at: u.updated_at,
        last_login_at: u.last_login_at ?? null,
        email_verified_at: u.email_verified_at ?? null,
      });
    } catch (e: any) {
      setDetailError(e?.message ?? "Gagal memuat detail user");
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = useUserColumns(handleDelete, { onDetail: openDetail });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detailOpen]);

  const [search, setSearch] = useState("");
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const togglableColumns = useMemo(() => columns.filter((c) => c.key !== "actions"), [columns]);
  const columnOrder = useMemo(() => togglableColumns.map((c) => String(c.key)), [togglableColumns]);
  const defaultVisibleKeys = useMemo(() => {
    const preferred = new Set(["name", "role", "status"]);
    const picked = columnOrder.filter((key) => preferred.has(key));
    return picked.length > 0 ? picked : columnOrder;
  }, [columnOrder]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(defaultVisibleKeys);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);

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
      return [row.name, row.email, row.role, row.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [rows, search]);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, search, rows.length]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const startIndex = (page - 1) * rowsPerPage;
  const paginatedRows = useMemo(
    () => filteredRows.slice(startIndex, startIndex + rowsPerPage),
    [filteredRows, startIndex, rowsPerPage]
  );

  const userStats = useMemo(() => {
    let active = 0;
    let inactive = 0;

    rows.forEach((row) => {
      const normalized = String(row.status ?? "").toLowerCase().normalize("NFKD");
      const has = (...tokens: string[]) => tokens.some((token) => normalized.includes(token));

      if (has("non", "inaktif", "inactive", "deactive", "suspend", "blokir", "blocked", "disable")) {
        inactive += 1;
        return;
      }
      if (has("aktif", "active", "enable", "approved")) {
        active += 1;
        return;
      }
      if (row.is_active === false) {
        inactive += 1;
      } else {
        active += 1;
      }
    });

    const total = rows.length;
    if (active + inactive !== total) {
      inactive += Math.max(0, total - (active + inactive));
    }

    const activePercent = total ? Math.round((active / total) * 100) : 0;
    const inactivePercent = total ? Math.round((inactive / total) * 100) : 0;
    const totalPercent = activePercent;

    return { total, active, inactive, totalPercent, activePercent, inactivePercent };
  }, [rows]);

  const numberColumn: Column<UserRow> = useMemo(() => ({
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
        .filter(Boolean) as Column<UserRow>[],
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
        <h1 className="text-3xl font-semibold text-slate-900">Users Dashboard</h1>
        <p className="text-sm text-slate-500">Monitor the latest activity and keep every account aligned.</p>
      </div>

      <StatsRow stats={userStats} loading={loading} />

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
                placeholder="Type a name, email, or role…"
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
            <Link
              href="/dashboard/users/create"
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
            >
              <Plus className="h-4 w-4" />
              Create User
            </Link>
          </div>
        </div>

        <DataTable columns={visibleColumns as Column<UserRow>[]} data={paginatedRows} loading={loading} />

        {detailOpen && (
          (typeof document !== 'undefined') ? createPortal(
          <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-6">
            <div className="absolute inset-0 z-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
            <div className="relative z-10 mt-16 w-full max-w-5xl">
              <div className="rounded-3xl bg-white/95 shadow-[0_25px_45px_rgba(15,23,42,0.18)] ring-1 ring-slate-100 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h3 className="text-lg font-semibold text-slate-900">User Detail</h3>
                  <button
                    type="button"
                    onClick={() => setDetailOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
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
                          <Skeleton className="h-6 w-24 rounded-full" />
                          <Skeleton className="h-6 w-20 rounded-full" />
                          <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                      </div>
                    ) : detailData ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="h-16 w-16 rounded-full bg-white/20 grid place-items-center text-lg font-bold">
                            {getInitials(detailData.name, detailData.email)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xl font-semibold text-white">{detailData.name}</div>
                            <div className="mt-1 inline-flex items-center gap-2 text-sm text-white/80">
                              <Mail className="h-4 w-4" />
                              <span className="truncate max-w-[220px] md:max-w-[260px]">{detailData.email}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {detailData.role && (
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                              {detailData.role}
                            </span>
                          )}
                          {detailData.division?.name && (
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                              {detailData.division.name}
                            </span>
                          )}
                          <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", (detailData.status ?? '').toLowerCase().includes('non') ? 'bg-rose-50 text-rose-500 ring-1 ring-rose-200' : 'bg-emerald-50 text-emerald-500 ring-1 ring-emerald-200'].join(' ')}>
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/40" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                            </span>
                            {detailData.status}
                          </span>
                          {detailData.is_active ? (
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                              <ShieldCheck className="h-4 w-4" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
                              <AlertCircle className="h-4 w-4" /> Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </aside>

                  <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
                    {detailLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="space-y-2">
                            <Skeleton className="h-3 w-20 rounded" />
                            <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
                          </div>
                        ))}
                      </div>
                    ) : detailError ? (
                      <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{detailError}</div>
                    ) : detailData ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        <Row label="Name" value={detailData.name} />
                        <Row label="Email" value={detailData.email} />
                        <Row label="Role" value={detailData.role ?? '-'} />
                        <Row label="Division" value={detailData.division?.name ?? '-'} />
                        <Row label="Status" value={detailData.status ?? '-'} />
                        <Row label="Active" value={detailData.is_active ? 'Yes' : 'No'} />
                        <Row label="Last Login" value={detailData.last_login_at ?? '-'} />
                        <Row label="Email Verified" value={detailData.email_verified_at ?? '-'} />
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
            Showing {summaryStart} to {summaryEnd} of {filteredRows.length} user{filteredRows.length === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Rows per page
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="h-10 rounded-full border-0 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
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
