"use client";

import * as React from "react";
import { apiRequest } from "@/lib/api";
import BaselineSelect from "@/components/evm/BaselineSelect";
import { useBaselines } from "@/hooks/useBaselines";

type EvmCostSummary = {
  unit?: "IDR" | string;
  bac?: number | string | null;
  pv?: number | string | null;
  ev?: number | string | null;
  ac?: number | string | null;
  sv?: number | string | null;
  spi?: number | string | null;
  cv?: number | string | null;
  cpi?: number | string | null;
  eac?: number | string | null;
  etc?: number | string | null;
  meta?: Record<string, any> | null;
  [key: string]: any;
};

export type EvmCostWidgetProps = {
  projectId: number | string;
  date?: string; // YYYY-MM-DD (default: today)
  baselineId?: number | null;
  onBaselineChange?: (id: number | null) => void;
  showBaselineSelect?: boolean;
  className?: string;
  reloadKey?: number;
};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function asNumber(v: any): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatIDR(value: any): string {
  const n = asNumber(value) ?? 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatIndex(value: any): string {
  const n = asNumber(value);
  if (n == null) return "—";
  return n.toFixed(3).replace(/\.?0+$/, "");
}

function isAllZeroish(d: EvmCostSummary): boolean {
  const keys = ["bac", "pv", "ev", "ac", "sv", "cv"] as const;
  return keys.every((k) => {
    const n = asNumber((d as any)[k]);
    return n == null || Math.abs(n) < 1e-9;
  });
}

function KpiCard({
  label,
  value,
  hint,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  badge?: { text: string; tone: "yellow" | "green" | "red" | "neutral" } | null;
}) {
  const toneClass =
    badge?.tone === "green"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : badge?.tone === "red"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : badge?.tone === "yellow"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-neutral-50 text-neutral-700 border-neutral-200";

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-inner">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          {label}
        </div>
        {badge ? (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full border ${toneClass}`}
          >
            {badge.text}
          </span>
        ) : null}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-[11px] text-neutral-500">{hint}</div>
      ) : null}
    </div>
  );
}

export default function EvmCostWidget({
  projectId,
  date,
  baselineId,
  onBaselineChange,
  showBaselineSelect = true,
  className,
  reloadKey,
}: EvmCostWidgetProps) {
  const [internalBaselineId, setInternalBaselineId] = React.useState<number | null>(null);
  const isControlled = typeof baselineId !== "undefined";
  const activeBaselineId = isControlled ? (baselineId ?? null) : internalBaselineId;

  const [when, setWhen] = React.useState<string>(date || todayISO());
  const [data, setData] = React.useState<EvmCostSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { baselines } = useBaselines(projectId);
  const projectBaselines = React.useMemo(
    () => (Array.isArray(baselines)
      ? baselines.filter((baseline: any) => String(baseline?.project_id ?? "") === String(projectId))
      : []),
    [baselines, projectId]
  );
  const validBaselineId = React.useMemo(() => {
    if (activeBaselineId == null) return null;
    return projectBaselines.some((baseline) => Number(baseline.id) === Number(activeBaselineId))
      ? activeBaselineId
      : null;
  }, [activeBaselineId, projectBaselines]);

  React.useEffect(() => {
    setData(null);
    setError(null);
    if (!isControlled) {
      setInternalBaselineId(null);
    }
    setWhen(date || todayISO());
  }, [projectId, date, isControlled]);

  React.useEffect(() => {
    if (isControlled) return;
    if (internalBaselineId != null) return;
    if (projectBaselines.length > 0) {
      setInternalBaselineId(Number(projectBaselines[0].id));
    }
  }, [isControlled, internalBaselineId, projectBaselines]);

  const load = React.useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { as_of: when };
      if (validBaselineId != null) params.baseline_id = validBaselineId;
      const res = await apiRequest<any>(
        "GET",
        `/api/projects/${encodeURIComponent(String(projectId))}/evm-cost`,
        undefined,
        { params }
      );
      const base =
        res && typeof res === "object" && "data" in res ? (res as any).data : res;
      setData(base as any);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load EVM cost (IDR)");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, when, validBaselineId, reloadKey]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleBaselineChange = (id: number | null) => {
    if (isControlled) onBaselineChange?.(id);
    else setInternalBaselineId(id);
  };

  const bac = asNumber(data?.bac) ?? 0;
  const pv = asNumber(data?.pv) ?? 0;
  const ev = asNumber(data?.ev) ?? 0;
  const ac = asNumber(data?.ac) ?? 0;

  const budgetNotAllocated = bac <= 0 && pv <= 0 && ev <= 0;
  const taskBudgetMissing = bac > 0 && pv <= 0 && ev <= 0;
  const noActualCost = ac <= 0;

  return (
    <div className={className}>
      <div className="flex items-end justify-between mb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">EVM (Cost-Based / IDR)</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-neutral-50 text-neutral-700 border-neutral-200">
              Cost-based
            </span>
          </div>
          <div className="text-xs text-neutral-600">
            Unit: IDR • PV/EV dari budget task, AC dari ledger biaya aktual
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div>
            <label className="block text-xs text-neutral-600 mb-1">As of Date</label>
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
          {showBaselineSelect && (
            <BaselineSelect
              projectId={projectId}
              value={validBaselineId}
              onChange={handleBaselineChange}
              includeNoneOption
            />
          )}
          <button
            type="button"
            className="self-end h-[36px] px-3 py-2 rounded-md border text-sm hover:bg-neutral-50"
            onClick={load}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        {loading ? (
          <div className="text-sm text-neutral-500">Loading EVM cost (IDR)...</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : !data ? (
          <div className="text-sm text-neutral-500">No cost data</div>
        ) : (
          <>
            {budgetNotAllocated && (
              <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Budget belum dialokasikan (BAC/PV/EV masih 0). Set `budget_cost` pada task atau isi `projects.value_amount`.
              </div>
            )}
            {!budgetNotAllocated && taskBudgetMissing && (
              <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Task `budget_cost` belum diisi (PV/EV masih 0) meskipun BAC sudah ada. Isi `budget_cost` pada task agar PV/EV bisa dihitung.
              </div>
            )}
            {!budgetNotAllocated && isAllZeroish(data) && (
              <div className="mb-3 text-xs text-neutral-600">
                Belum ada progress dan/atau biaya aktual sampai tanggal as-of.
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <KpiCard label="BAC" value={formatIDR(data.bac)} />
              <KpiCard label="PV" value={formatIDR(data.pv)} hint="Planned Value (IDR)" />
              <KpiCard label="EV" value={formatIDR(data.ev)} hint="Earned Value (IDR)" />
              <KpiCard
                label="AC"
                value={formatIDR(data.ac)}
                hint="Actual Cost (IDR)"
                badge={noActualCost ? { text: "AC=0", tone: "yellow" } : null}
              />
              <KpiCard label="SV" value={formatIDR(data.sv)} hint="EV − PV" />

              <KpiCard label="SPI" value={pv <= 0 ? "—" : formatIndex(data.spi)} hint="EV / PV" />
              <KpiCard label="CV" value={formatIDR(data.cv)} hint="EV − AC" />
              <KpiCard label="CPI" value={ac <= 0 ? "—" : formatIndex(data.cpi)} hint="EV / AC" />
              <KpiCard label="EAC" value={data.eac == null ? "—" : formatIDR(data.eac)} hint="Estimate at Completion" />
              <KpiCard label="ETC" value={data.etc == null ? "—" : formatIDR(data.etc)} hint="Estimate to Complete" />
            </div>

            <div className="mt-3 text-[11px] text-neutral-500">
              BAC source: {String((data.meta as any)?.bac_source ?? "-")} • PV/EV:{" "}
              {String((data.meta as any)?.pv_ev_source ?? "-")} • AC:{" "}
              {String((data.meta as any)?.ac_source ?? "-")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
