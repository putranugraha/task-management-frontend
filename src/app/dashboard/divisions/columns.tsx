"use client";

import { ArrowRight, Building2, CircleOff, Pencil } from "lucide-react";

export type DivisionRow = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  status?: string | null;
  users?: { id: number; name: string }[];
  users_count?: number;
  created_at?: string;
  created_at_date?: string;
  created_at_time?: string;
};

export type Column<T> = {
  key: keyof T | "actions";
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
};

const isInactiveDivision = (row: DivisionRow) => {
  const status = String(row.status ?? "").toLowerCase();
  return status.includes("non") || status.includes("inaktif") || status.includes("inactive");
};

const statusClasses = (value?: string | null) => {
  return isInactiveDivision({ status: value } as DivisionRow)
    ? "bg-rose-50 text-rose-500 ring-1 ring-rose-200"
    : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200";
};

export function useDivisionColumns(
  onDeactivate?: (row: DivisionRow) => void,
  opts?: {
    minimal?: boolean;
    onDetail?: (row: DivisionRow) => void;
    onActivate?: (row: DivisionRow) => void;
    activatingId?: number | null;
    canEdit?: boolean;
    canDelete?: boolean;
  }
): Column<DivisionRow>[] {
  const minimal = opts?.minimal === true;
  const canEdit = opts?.canEdit ?? true;
  const canDelete = opts?.canDelete ?? true;

  const minimalCols: Column<DivisionRow>[] = [
    {
      key: "name",
      header: "Name",
      className: "min-w-[220px]",
      render: (r) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{r.name ?? '-'}</div>
          {r.code && (
            <div className="mt-0.5 inline-flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{r.code}</span>
              {typeof r.users_count === 'number' && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200">
                  {r.users_count} users
                </span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      className: "min-w-[220px]",
      render: (r) => (
        <span className="text-sm text-slate-600 line-clamp-2">{r.description ?? '-'}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => (
        <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusClasses(r.status)].join(" ")}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          {r.status ?? "Aktif"}
        </span>
      ),
    },
  ];

  const fullCols: Column<DivisionRow>[] = [
    {
      key: "name",
      header: "Name",
      className: "min-w-[220px]",
      render: (r) => (
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{r.name ?? '-'}</div>
          <div className="mt-0.5 inline-flex items-center gap-2 text-xs text-slate-500">
            {r.code && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">{r.code}</span>
            )}
            {typeof r.users_count === 'number' && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 ring-1 ring-emerald-200">
                {r.users_count} users
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      className: "min-w-[220px]",
      render: (r) => (
        <span className="text-sm text-slate-600 line-clamp-2">{r.description ?? '-'}</span>
      ),
    },
    {
      key: "users_count",
      header: "Users",
      align: "center",
      className: "min-w-[100px]",
      render: (r) => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
          {typeof r.users_count === 'number' ? r.users_count : (Array.isArray(r.users) ? r.users.length : 0)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (r) => (
        <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusClasses(r.status)].join(" ")}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          {r.status ?? "Aktif"}
        </span>
      ),
    },
    {
      key: "created_at_date",
      header: "Date",
      className: "min-w-[120px]",
      render: (r) => {
        if (!r.created_at) return <span className="text-slate-400">-</span>;
        const d = new Date(r.created_at);
        return <span className="text-sm font-medium text-slate-700">{d.toLocaleDateString()}</span>;
      },
    },
    {
      key: "created_at_time",
      header: "Time",
      align: "center",
      render: (r) => {
        if (!r.created_at) return <span className="text-slate-400">-</span>;
        const d = new Date(r.created_at);
        return <span className="text-sm font-semibold text-slate-700">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
      },
    },
  ];

  const cols = minimal ? minimalCols : fullCols;

  return [
    ...cols,
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2 text-sm">
          {opts?.onDetail ? (
            <button
              type="button"
              onClick={() => opts.onDetail?.(row)}
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#008061]"
            >
              Detail
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <a
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#008061]"
              href={`/dashboard/divisions/${row.id}`}
            >
              Detail
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}
          {canEdit && (
            <a
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-[#00674F]/10 text-[#00674F] transition hover:bg-[#00674F]/20"
              href={`/dashboard/divisions/${row.id}/edit`}
              title={`Edit ${row.name}`}
            >
              <Pencil className="h-4 w-4" />
            </a>
          )}
          {canEdit && isInactiveDivision(row) && (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 disabled:opacity-60"
              onClick={() => opts?.onActivate?.(row)}
              disabled={Number(opts?.activatingId) === Number(row.id)}
              title={`Aktifkan ${row.name}`}
            >
              <Building2 className="h-4 w-4" />
            </button>
          )}
          {canDelete && !isInactiveDivision(row) && (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-amber-50 text-amber-600 transition hover:bg-amber-100"
              onClick={() => onDeactivate?.(row)}
              title={`Nonaktifkan ${row.name}`}
            >
              <CircleOff className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];
}
