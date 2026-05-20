"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/auth-context";
import Forbidden from "@/components/auth/Forbidden";
import { Skeleton } from "@/components/ui/skeleton";
import { RowsPerPageControl } from "@/components/dashboard/RowsPerPageControl";
import { listActivityLogs, type ActivityLog } from "@/lib/api/activity-logs";
import DataTable from "../users/data-table";
import type { Column } from "../users/columns";

type ActivityLogRow = ActivityLog;

const BASE_COLUMNS: Column<ActivityLogRow>[] = [
  {
    key: "time",
    header: "Waktu",
    className: "min-w-[200px]",
    render: (row) =>
      row.time ? (
        <span className="text-sm font-medium text-slate-700">
          {new Date(row.time).toLocaleString()}
        </span>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
  },
  {
    key: "actor_name",
    header: "Actor",
    className: "min-w-[140px]",
    render: (row) => (
      <span className="text-sm font-semibold text-slate-800">
        {row.actor_name ?? "-"}
      </span>
    ),
  },
  {
    key: "event",
    header: "Event",
    className: "min-w-[220px]",
    render: (row) => (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-700">{row.event ?? "-"}</span>
        {row.log_name && (
          <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {row.log_name}
          </span>
        )}
      </div>
    ),
  },
  {
    key: "subject",
    header: "Target",
    className: "min-w-[220px]",
    render: (row) =>
      row.subject_type ? (
        <span className="text-sm text-slate-700">
          {row.subject_type}
          {row.subject_id ? ` #${row.subject_id}` : ""}
        </span>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
  },
];

export default function ActivityLogPage() {
  const { state, hasRole } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);

  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);

  const [rawOpen, setRawOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLogRow | null>(null);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !state?.isInitialized) return;
    if (!hasRole("Admin")) return;

    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const items = await listActivityLogs({ per_page: 200 });
        if (!cancelled) setLogs(items);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e && typeof e === "object" && "message" in e
              ? String((e as { message?: string }).message)
              : "Gagal memuat activity log";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [hydrated, state, hasRole]);

  const openRaw = (row: ActivityLogRow) => {
    setSelectedLog(row);
    setRawOpen(true);
  };

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) => {
      const values: Array<unknown> = [
        log.actor_name,
        log.event,
        log.log_name,
        log.subject_type,
        log.subject_id,
        log.id,
      ];
      return values
        .filter((v) => v != null)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [logs, search]);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, search, filteredLogs.length]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / rowsPerPage || 1)
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const startIndex = (page - 1) * rowsPerPage;
  const paginatedLogs = useMemo(
    () => filteredLogs.slice(startIndex, startIndex + rowsPerPage),
    [filteredLogs, startIndex, rowsPerPage]
  );

  const summaryStart = filteredLogs.length === 0 ? 0 : startIndex + 1;
  const summaryEnd =
    filteredLogs.length === 0 ? 0 : startIndex + paginatedLogs.length;

  const columns: Column<ActivityLogRow>[] = useMemo(
    () => [
      ...BASE_COLUMNS,
      {
        key: "raw",
        header: "Raw",
        align: "center",
        className: "w-[80px]",
        render: (row) => (
          <button
            type="button"
            onClick={() => openRaw(row)}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-emerald-400 hover:text-emerald-700"
          >
            View
          </button>
        ),
      },
    ],
    []
  );

  if (!hydrated || !state || !state.isInitialized) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!hasRole("Admin")) {
    return <Forbidden />;
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Activity Log</h1>
        <p className="text-sm text-slate-500">
          Pantau jejak aktivitas penting yang dilakukan oleh pengguna di sistem.
        </p>
      </div>

      {error && !loading && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">
                Filter
              </span>
              <div className="relative flex h-10 w-full items-center overflow-hidden rounded-xl border border-transparent bg-white/90 shadow-[0_12px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 transition focus-within:ring-2 focus-within:ring-[#00674F] md:min-w-[260px] md:max-w-sm">
                <span className="pointer-events-none absolute left-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-[#00674F]/10 text-[#00674F]">
                  <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari actor, event, atau target"
                  className="h-full w-full rounded-xl border-0 bg-transparent pl-11 pr-3 text-xs font-medium text-slate-600 outline-none placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>
        </div>

        <DataTable<ActivityLogRow>
          columns={columns}
          data={paginatedLogs}
          loading={loading}
          emptyText="Belum ada activity log yang tercatat."
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 text-sm text-slate-600">
          <span>
            Showing {summaryStart} to {summaryEnd} of {filteredLogs.length} log
            {filteredLogs.length === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <RowsPerPageControl
              value={rowsPerPage}
              onChange={(next) => setRowsPerPage(next)}
            />
            <div className="flex items-center gap-1 text-slate-500">
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                «
              </button>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ‹
              </button>
              <span className="px-3 text-xs font-semibold text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                ›
              </button>
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
              >
                »
              </button>
            </div>
          </div>
        </div>
      </div>

      {rawOpen &&
        selectedLog &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-6">
            <div
              className="absolute inset-0 z-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setRawOpen(false)}
            />
            <div className="relative z-10 mt-16 w-full max-w-4xl">
              <div className="overflow-hidden rounded-3xl bg-white/95 shadow-[0_25px_45px_rgba(15,23,42,0.18)] ring-1 ring-slate-100">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Raw Activity
                    </h3>
                    <p className="text-xs text-slate-500">
                      ID #{selectedLog.id} ·{" "}
                      {selectedLog.event ?? "Unknown event"} ·{" "}
                      {selectedLog.actor_name ?? "Unknown actor"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRawOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
                </div>
                <div className="max-h-[70vh] overflow-auto bg-slate-950 px-6 py-4">
                  <pre className="whitespace-pre-wrap break-all text-xs font-mono text-slate-100">
                    {JSON.stringify(selectedLog.properties ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
