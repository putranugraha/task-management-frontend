"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { User as UserType } from "@/types/user";
import DataTable from "./data-table";
import { useUserColumns, type Column, type UserRow } from "./columns";
import { UsersIcon, UserIcon, UserMinusIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";
import { Download, Plus, SlidersHorizontal } from "lucide-react";

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

  const columns = useUserColumns(handleDelete);

  const [search, setSearch] = useState("");
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const togglableColumns = useMemo(() => columns.filter((c) => c.key !== "actions"), [columns]);
  const columnOrder = useMemo(() => togglableColumns.map((c) => String(c.key)), [togglableColumns]);
  const defaultVisibleKeys = useMemo(() => {
    const preferred = new Set(["name", "email", "job_title", "status"]);
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

  const numberColumn: Column<UserRow> = useMemo(() => ({
    key: "__number",
    header: "No",
    align: "center",
    className: "w-16",
    render: (_row, index) => startIndex + index + 1,
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

  const exportAll = () => {
    try {
      const payload = JSON.stringify(rows, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "users.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Failed to export users");
    }
  };

  return (
    <div className="w-full space-y-5">
      <div>
        <h1 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Users Management</h1>
        <p className="text-sm text-neutral-500">Manage user accounts and permissions.</p>
      </div>

      <StatsRow rows={rows} loading={loading} />

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      <div className="rounded-2xl border bg-white/80 dark:bg-neutral-950/60 backdrop-blur supports-[backdrop-filter]:bg-white/70 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 border-b bg-white/60 dark:bg-neutral-900/60">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name or email..."
                className="h-10 w-60 rounded-lg border px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="relative" ref={columnMenuRef}>
              <button
                type="button"
                onClick={() => setColumnMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border text-sm font-medium shadow-sm bg-white hover:bg-neutral-50"
                aria-haspopup="menu"
                aria-expanded={columnMenuOpen}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Columns
              </button>
              {columnMenuOpen && (
                <div className="absolute z-30 mt-2 w-52 rounded-lg border bg-white shadow-lg p-2">
                  <p className="text-xs font-semibold text-neutral-500 px-1 pb-2">Toggle columns</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {togglableColumns.map((col) => {
                      const key = String(col.key);
                      const checked = visibleKeys.includes(key);
                      return (
                        <label key={key} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-neutral-100">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5"
                            checked={checked}
                            onChange={() => toggleColumn(key)}
                          />
                          <span className="truncate">{col.header}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/users/create"
              className="inline-flex items-center gap-2 rounded-lg bg-[#00674F] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#008061]"
            >
              <Plus className="h-4 w-4" />
              Create User
            </Link>
          </div>
        </div>

        <DataTable columns={visibleColumns as Column<UserRow>[]} data={paginatedRows} loading={loading} />

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-neutral-50/80 text-sm text-neutral-600">
          <span>
            Showing {summaryStart} to {summaryEnd} of {filteredRows.length} user{filteredRows.length === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-neutral-500">Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                className="h-9 rounded-md border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <button
                className="h-9 w-9 rounded-md border bg-white hover:bg-neutral-100 disabled:opacity-40"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                «
              </button>
              <button
                className="h-9 w-9 rounded-md border bg-white hover:bg-neutral-100 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ‹
              </button>
              <span className="px-2 text-sm">Page {page} of {totalPages}</span>
              <button
                className="h-9 w-9 rounded-md border bg-white hover:bg-neutral-100 disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                ›
              </button>
              <button
                className="h-9 w-9 rounded-md border bg-white hover:bg-neutral-100 disabled:opacity-40"
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

function StatsRow({ rows, loading }: { rows: UserRow[]; loading: boolean }) {
  const { total, active, inactive } = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((u) => {
      const status = String(u.status ?? '').toLowerCase();
      return u.is_active === true || status.includes('aktif') || status.includes('active');
    }).length;
    const inactive = Math.max(0, total - active);
    return { total, active, inactive };
  }, [rows]);

  const Card = ({
    title,
    value,
    TopIcon,
    tone,
    sub,
  }: {
    title: string
    value: number
    TopIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>
    tone: "cyan" | "emerald" | "rose"
    sub?: { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; text: string }
  }) => {
    const toneMap: Record<string, { bar: string; badge: string; text: string; ring: string }> = {
      cyan: { bar: "bg-cyan-400", badge: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20", text: "", ring: "" },
      emerald: { bar: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20", text: "text-emerald-600 dark:text-emerald-300", ring: "" },
      rose: { bar: "bg-rose-400", badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20", text: "text-rose-600 dark:text-rose-300", ring: "" },
    }
    const t = toneMap[tone]
    return (
      <div className="relative rounded-xl border bg-white/80 dark:bg-neutral-950/50 backdrop-blur supports-[backdrop-filter]:bg-white/60 p-4 shadow-sm transition-all duration-200 hover:shadow-md">
        <span className={["absolute left-0 top-3 bottom-3 w-1 rounded-full", t.bar].join(" ")} />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-neutral-500">{title}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {loading ? <span className="inline-block h-8 w-16 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" /> : value}
            </div>
          </div>
          <div className={["h-9 w-9 rounded-full grid place-items-center", t.badge].join(" ")}>
            <TopIcon className="h-5 w-5" />
          </div>
        </div>
        {sub && (
          <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
            <sub.icon className={["h-4 w-4", t.text].join(" ")} />
            <span className="truncate">{sub.text}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
      <Card
        title="Total Users"
        value={total}
        TopIcon={UsersIcon}
        tone="cyan"
        sub={{ icon: ArrowTrendingUpIcon, text: `${total ? Math.round((active / Math.max(1,total)) * 100) : 0}% active users` }}
      />
      <Card
        title="Active"
        value={active}
        TopIcon={UserIcon}
        tone="emerald"
        sub={{ icon: ArrowTrendingUpIcon, text: `${total ? Math.round((active / Math.max(1,total)) * 100) : 0}% of total` }}
      />
      <Card
        title="Inactive"
        value={inactive}
        TopIcon={UserMinusIcon}
        tone="rose"
        sub={{ icon: ArrowTrendingDownIcon, text: `${total ? Math.round((inactive / Math.max(1,total)) * 100) : 0}% of total` }}
      />
    </div>
  );
}
