"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiRequest } from "@/lib/api";
import { RowsPerPageControl } from "@/components/dashboard/RowsPerPageControl";
import type { Division } from "@/types/division";
import DataTable from "../users/data-table";
import { useDivisionColumns, type DivisionRow, type Column } from "./columns";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { SlidersHorizontal, Plus, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type MaybePaginated<T> =
  | T[]
  | { data: T[] }
  | { data: { data: T[] } }
  | { divisions: T[] }
  | { items: T[] };

export default function DivisionsPage() {
  const [rows, setRows] = useState<DivisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<DivisionRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const pickList = (res: any): any[] => {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.divisions)) return res.divisions;
    if (Array.isArray(res?.items)) return res.items;
    return [];
  };

  const fetchDivisions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MaybePaginated<Division>>("GET", "/api/divisions?with_users=true&with_users_count=true");
      const list = pickList(res);
      const mapped: DivisionRow[] = list.map((d: any) => {
        let users: { id: number; name: string }[] | undefined = undefined;
        const rawUsers = d?.users ?? d?.members ?? d?.users_list;
        if (Array.isArray(rawUsers)) {
          users = rawUsers.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email ?? String(u.id) }));
        } else if (rawUsers && Array.isArray(rawUsers?.data)) {
          users = rawUsers.data.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email ?? String(u.id) }));
        }
        return {
          id: Number(d.id),
          code: String(d.code ?? ''),
          name: d.name ?? d.division_name ?? d.title ?? d.label ?? String(d.code ?? ''),
          description: d.description ?? null,
          created_at: d.created_at ?? '',
          users,
          users_count: typeof d.users_count === 'number' ? d.users_count : (Array.isArray(users) ? users.length : undefined),
        } as DivisionRow;
      });
      setRows(mapped);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to load divisions";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat divisions",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDivisions(); }, []);

  const handleDelete = (row: DivisionRow) => {
    setDeleteTarget(row);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiRequest("DELETE", `/api/divisions/${deleteTarget.id}`);
      await fetchDivisions();
      showToast({
        variant: "success",
        title: "Division dihapus",
        description: `Division ${deleteTarget.name} berhasil dihapus.`,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menghapus division";
      showToast({
        variant: "error",
        title: "Gagal menghapus division",
        description: msg,
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const baseColumns = useDivisionColumns(handleDelete, { minimal: false, onDetail: openDetail }) as unknown as Column<DivisionRow>[];

  // Column visibility (mirrors Users page)
  const togglableColumns = useMemo(() => baseColumns.filter((c) => c.key !== "actions"), [baseColumns]);
  const columnOrder = useMemo(() => togglableColumns.map((c) => String(c.key)), [togglableColumns]);
  const defaultVisibleKeys = useMemo(() => {
    const preferred = new Set(["name", "users_count", "description"]);
    const picked = columnOrder.filter((k) => preferred.has(k));
    return picked.length ? picked : columnOrder;
  }, [columnOrder]);
  const [visibleKeys, setVisibleKeys] = useState<string[]>(defaultVisibleKeys);
  const columnMenuRef = useRef<HTMLDivElement | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  useEffect(() => {
    const valid = new Set(columnOrder);
    setVisibleKeys((prev) => {
      const filtered = prev.filter((k) => valid.has(k));
      if (filtered.length === prev.length && filtered.every((k, i) => k === prev[i])) return prev;
      return filtered.length ? filtered : defaultVisibleKeys;
    });
  }, [columnOrder, defaultVisibleKeys]);

  useEffect(() => {
    if (!columnMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!columnMenuRef.current) return;
      if (!columnMenuRef.current.contains(e.target as Node)) setColumnMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [columnMenuOpen]);

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      const idx = columnOrder.indexOf(key);
      if (idx === -1) return prev;
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

  // Filtering + pagination
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => [r.name, r.code, r.description]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(term))
    );
  }, [rows, search]);

  useEffect(() => { setPage(1); }, [rowsPerPage, search, rows.length]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const startIndex = (page - 1) * rowsPerPage;
  const paginatedRows = useMemo(() => filteredRows.slice(startIndex, startIndex + rowsPerPage), [filteredRows, startIndex, rowsPerPage]);

  const numberColumn: Column<DivisionRow> = useMemo(() => ({
    key: "__number" as any,
    header: "No",
    align: "center" as any,
    className: "w-[80px]",
    render: (_row, index) => (
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">
        {startIndex + index + 1}
      </span>
    ),
  }), [startIndex]);

  const visibleColumns = useMemo(() => {
    const set = new Set(visibleKeys);
    const orderedVisible = columnOrder.filter((k) => set.has(k));
    const selected = orderedVisible
      .map((key) => baseColumns.find((c) => String(c.key) === key))
      .filter(Boolean) as Column<DivisionRow>[];
    const actions = baseColumns.filter((c) => c.key === "actions") as Column<DivisionRow>[];
    return [numberColumn, ...selected, ...actions];
  }, [baseColumns, numberColumn, visibleKeys, columnOrder]);

  // Detail modal state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{
    id: number;
    code: string;
    name: string;
    description: string | null;
    users?: { id: number; name: string; email?: string }[];
    users_count?: number;
    created_at?: string;
    updated_at?: string;
  } | null>(null);

  async function openDetail(row: DivisionRow) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await apiRequest<any>("GET", `/api/divisions/${row.id}?with_users=true&with_users_count=true`);
      const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
      const d = Array.isArray(payload) ? payload[0] : payload;
      let users: { id: number; name: string; email?: string }[] | undefined;
      const raw = d?.users ?? d?.members ?? d?.users_list;
      if (Array.isArray(raw)) {
        users = raw.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email ?? String(u.id), email: u.email }));
      } else if (raw && Array.isArray(raw?.data)) {
        users = raw.data.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email ?? String(u.id), email: u.email }));
      }
      setDetailData({
        id: Number(d.id),
        code: String(d.code ?? ''),
        name: d.name ?? d.division_name ?? d.title ?? d.label ?? '',
        description: d.description ?? null,
        users,
        users_count: typeof d.users_count === 'number' ? d.users_count : (Array.isArray(users) ? users.length : undefined),
        created_at: d.created_at ?? '',
        updated_at: d.updated_at ?? '',
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal memuat division";
      setDetailError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat division",
        description: msg,
      });
    } finally {
      setDetailLoading(false);
    }
  }

  // Lock body scroll when modal open
  useEffect(() => {
    if (!detailOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [detailOpen]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Divisions</h1>
        <p className="text-sm text-slate-500">Kelola struktur organisasi dan pastikan anggota terkelompok rapi.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-center">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">Quick Search</span>
          <div className="relative flex h-12 w-full items-center overflow-hidden rounded-xl border border-transparent bg-white/90 shadow-[0_15px_30px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition focus-within:ring-2 focus-within:ring-[#00674F] md:max-w-md">
            <span className="pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-[#00674F]/10 text-[#00674F]">
              <MagnifyingGlassIcon className="h-4 w-4" />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a name, code, or description…"
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
                <div className="max-h-56 space-y-1 overflow-auto pr-1">
                  {columnOrder.map((key) => {
                    const col = baseColumns.find((c) => String(c.key) === key)!;
                    const checked = visibleKeys.includes(key);
                    return (
                      <label key={key} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-[#00674F] focus:ring-[#00674F]"
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
            href="/dashboard/divisions/create"
            className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
          >
            <Plus className="h-4 w-4" />
            Create Division
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{error}</div>
      )}

      <DataTable columns={visibleColumns as any} data={paginatedRows} loading={loading} />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Hapus division ini?"
        description={deleteTarget ? `Division "${deleteTarget.name}" akan dihapus dari sistem.` : ""}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (deleteLoading) return;
          setDeleteTarget(null);
        }}
      />

      {detailOpen && (
        (typeof document !== 'undefined') ? createPortal(
          <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-6">
            <div className="absolute inset-0 z-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDetailOpen(false)} />
            <div className="relative z-10 mt-16 w-full max-w-5xl">
              <div className="rounded-3xl bg-white/95 shadow-[0_25px_45px_rgba(15,23,42,0.18)] ring-1 ring-slate-100 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h3 className="text-lg font-semibold text-slate-900">Division Detail</h3>
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
                        <div className="space-y-2">
                          <Skeleton className="h-5 w-40 rounded" />
                          <Skeleton className="h-4 w-28 rounded" />
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
                          <div className="mt-1 inline-flex items-center gap-2 text-sm text-white/80">
                            {detailData.code && (
                              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                                {detailData.code}
                              </span>
                            )}
                            {typeof detailData.users_count === 'number' && (
                              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                                {detailData.users_count} users
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </aside>

                  <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
                    {detailLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                        {[...Array(6)].map((_, i) => (
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
                        <Row label="Code" value={detailData.code || '-'} />
                        <Row label="Description" value={detailData.description || '-'} />
                        <Row label="Users" value={Array.isArray(detailData.users) && detailData.users.length ? detailData.users.map(u => u.name).join(', ') : '-'} />
                        <Row label="Total Users" value={String(detailData.users_count ?? (detailData.users?.length ?? 0))} />
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

      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 px-1 py-3 text-sm text-slate-600">
        <span>
          Showing {filteredRows.length === 0 ? 0 : startIndex + 1} to {filteredRows.length === 0 ? 0 : startIndex + paginatedRows.length} of {filteredRows.length} division{filteredRows.length === 1 ? '' : 's'}
        </span>
        <div className="flex flex-wrap items-center gap-4">
          <RowsPerPageControl
            value={rowsPerPage}
            onChange={(next) => setRowsPerPage(next)}
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
