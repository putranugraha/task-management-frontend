"use client";

import * as React from "react";
import { apiRequest } from "@/lib/api";
import BaselineSelect from "@/components/evm/BaselineSelect";
import { useBaselines } from "@/hooks/useBaselines";
import type { ProjectBaseline } from "@/types/project-baseline";
import {
  topTasksByHoursAsOf,
  totalHoursByProjectAsOf,
  type ProjectTopTaskByHours,
} from "@/lib/api/time-entries-aggregate";

type EvmSummary = {
  pv?: number; // Planned Value
  ev?: number; // Earned Value
  ac?: number; // Actual Cost
  sv?: number; // Schedule Variance
  spi?: number; // Schedule Performance Index
  cv?: number; // Cost Variance
  cpi?: number; // Cost Performance Index
  // allow backend-specific extras
  [key: string]: any;
};

export type EvmWidgetProps = {
  projectId: number | string;
  date?: string; // YYYY-MM-DD (default: today)
  baselineId?: number | null; // controlled baseline id
  onBaselineChange?: (id: number | null) => void;
  showBaselineSelect?: boolean; // default true
  className?: string;
  reloadKey?: number; // trigger reload when changed
};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * EvmWidget
 * - Self-contained EVM display with optional BaselineSelect.
 * - Can run in uncontrolled (internal state) or controlled mode (props.baselineId).
 */
export function EvmWidget({ projectId, date, baselineId, onBaselineChange, showBaselineSelect = true, className, reloadKey }: EvmWidgetProps) {
  const [internalBaselineId, setInternalBaselineId] = React.useState<number | null>(null);
  const isControlled = typeof baselineId !== "undefined";
  const activeBaselineId = isControlled ? (baselineId ?? null) : internalBaselineId;

  const [when, setWhen] = React.useState<string>(date || todayISO());
  const [data, setData] = React.useState<EvmSummary | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [actualHours, setActualHours] = React.useState<number>(0);
  const [topTasks, setTopTasks] = React.useState<ProjectTopTaskByHours[]>([]);
  const [hoursLoading, setHoursLoading] = React.useState<boolean>(false);
  const [hoursError, setHoursError] = React.useState<string | null>(null);

  // Load baselines to allow auto-select newest and show window hints
  const { baselines, isLoading: blLoading, hasLoaded: baselinesLoaded } = useBaselines(projectId);
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
    setActualHours(0);
    setTopTasks([]);
    setHoursError(null);
    if (!isControlled) {
      setInternalBaselineId(null);
    }
    setWhen(date || todayISO());
  }, [projectId, date, isControlled]);

  // Auto-select latest baseline if none selected (uncontrolled only)
  React.useEffect(() => {
    if (isControlled) return;
    if (!baselinesLoaded) return;
    if (internalBaselineId != null) return;
    if (projectBaselines.length > 0) {
      setInternalBaselineId(Number(projectBaselines[0].id));
    }
  }, [isControlled, baselinesLoaded, internalBaselineId, projectBaselines]);

  const waitingForAutoBaseline =
    showBaselineSelect &&
    !isControlled &&
    baselinesLoaded &&
    internalBaselineId == null &&
    projectBaselines.length > 0;

  const canLoadScheduleEvm =
    !showBaselineSelect ||
    isControlled ||
    (baselinesLoaded && !waitingForAutoBaseline);

  const loadScheduleMetrics = React.useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { date: when };
      if (validBaselineId != null) params.baseline_id = validBaselineId;
      const res = await apiRequest<any>("GET", `/api/projects/${encodeURIComponent(String(projectId))}/evm`, undefined, { params });
      const base = (res && typeof res === "object" && "data" in res) ? (res as any).data : res;
      const payload = normalizeEvmPayload(base);
      setData(payload);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load EVM");
    } finally {
      setLoading(false);
    }
  }, [projectId, when, validBaselineId, reloadKey]);

  React.useEffect(() => {
    if (!canLoadScheduleEvm) return;
    loadScheduleMetrics();
  }, [loadScheduleMetrics, canLoadScheduleEvm]);

  const loadTimeEntryAggregates = React.useCallback(async () => {
    if (!projectId) return;
    setHoursLoading(true);
    setHoursError(null);

    try {
      const [totalRes, topRes] = await Promise.allSettled([
        totalHoursByProjectAsOf(projectId, when),
        topTasksByHoursAsOf(projectId, when, 5),
      ]);

      if (totalRes.status === "fulfilled") {
        setActualHours(Number.isFinite(totalRes.value) ? totalRes.value : 0);
      } else {
        setActualHours(0);
        setHoursError(totalRes.reason?.message ?? "Failed to load actual hours");
      }

      if (topRes.status === "fulfilled") {
        setTopTasks(Array.isArray(topRes.value) ? topRes.value : []);
      } else {
        setTopTasks([]);
      }
    } catch (e: any) {
      setActualHours(0);
      setTopTasks([]);
      setHoursError(e?.message ?? "Failed to load actual hours");
    } finally {
      setHoursLoading(false);
    }
  }, [projectId, when]);

  React.useEffect(() => {
    loadTimeEntryAggregates();
  }, [loadTimeEntryAggregates]);

  const refreshAll = React.useCallback(async () => {
    if (!canLoadScheduleEvm) return;
    await Promise.allSettled([
      loadScheduleMetrics(),
      loadTimeEntryAggregates(),
    ]);
  }, [canLoadScheduleEvm, loadScheduleMetrics, loadTimeEntryAggregates]);

  const handleBaselineChange = (id: number | null) => {
    if (isControlled) {
      onBaselineChange?.(id);
    } else {
      setInternalBaselineId(id);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-end justify-between mb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Schedule Performance (Baseline)</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-neutral-50 text-neutral-700 border-neutral-200">
              Effort-based
            </span>
          </div>
          <div className="text-xs text-neutral-600">
            Unit: hours/effort (bukan rupiah) • Berbasis baseline rencana
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
            onClick={refreshAll}
          >Refresh</button>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        {loading || !canLoadScheduleEvm ? (
          <div className="text-sm text-neutral-500">Loading schedule performance...</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : !data ? (
          <div className="text-sm text-neutral-500">No schedule data</div>
        ) : (
          <>
            {isAllZero(data) && (
              <div className="mb-3 text-xs text-neutral-600">
                Belum ada progress — baseline sudah diset tapi belum ada task update.
              </div>
            )}
            {(() => {
              const pv = typeof data.pv === "number" ? data.pv : Number(data.pv);
              const pvIsZero = Number.isFinite(pv) && Math.abs(pv) < 1e-9;
              const spiValue = pvIsZero ? "—" : data.spi;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <Kpi label="PV (effort)" value={data.pv} />
                  <Kpi label="EV (effort)" value={data.ev} />
                  <Kpi label="SV (EV − PV)" value={data.sv} />
                  <Kpi
                    label="SPI (EV/PV)"
                    value={spiValue}
                    badge={pvIsZero ? null : indexBadge("spi", data.spi)}
                  />
                  <Kpi
                    label="Actual Hours (hours)"
                    hint="Kumulatif dari time entries sampai As-of date (≤)."
                    value={hoursLoading ? "..." : actualHours}
                    badge={
                      !hoursLoading &&
                      Math.abs(actualHours) < 1e-9 &&
                      (!topTasks || topTasks.length === 0)
                        ? { text: "No entries", tone: "yellow" }
                        : null
                    }
                  />
                </div>
              );
            })()}
            <div className="mt-3 text-xs text-neutral-600">
              {hoursError ? (
                <span className="text-red-600">{hoursError}</span>
              ) : topTasks && topTasks.length > 0 ? (
                <>
                  <div className="font-medium text-neutral-700">
                    Top 5 Tasks by Actual Hours (as-of)
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    Urutan berdasarkan total hours sampai As-of date (≤).
                  </div>
                  <ul className="mt-1 space-y-1">
                    {topTasks.slice(0, 5).map((it) => (
                      <li
                        key={String(it.task_id)}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="truncate">
                          {it.task_title || `Task #${it.task_id}`}
                        </span>
                        <span className="tabular-nums text-neutral-700">
                          {formatNumber(it.total_hours)} h
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <span>No entries.</span>
              )}
            </div>
            <DebugHint
              date={when}
              baseline={projectBaselines.find((b) => Number(b.id) === Number(validBaselineId))}
              meta={data?.meta}
              baselineId={(data as any)?.baseline_id ?? null}
              evmDate={(data as any)?.date ?? when}
              loadingBaselines={blLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}

function toNum(x: any): number | undefined {
  if (x == null) return undefined;
  const n = typeof x === "string" ? Number(x.replace(/[,\s]/g, "")) : Number(x);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeEvmPayload(input: any): EvmSummary {
  if (!input || typeof input !== "object") return {};

  // Allow nested shapes like { summary: {...} } or { evm: {...} }
  const src: any = input.summary || input.evm || input;

  // Common key aliases across EVM implementations
  const pv = toNum(src.pv ?? src.planned_value ?? src.pv_total ?? src.bcws);
  const ev = toNum(src.ev ?? src.earned_value ?? src.ev_total ?? src.bcwp);
  const ac = toNum(src.ac ?? src.actual_cost ?? src.ac_total ?? src.acwp);
  // If backend supplies variances/indices use them; otherwise derive
  const sv = toNum(src.sv ?? src.schedule_variance);
  const spi = toNum(src.spi ?? src.schedule_performance_index);
  const cv = toNum(src.cv ?? src.cost_variance);
  const cpi = toNum(src.cpi ?? src.cost_performance_index);

  const out: EvmSummary = { pv, ev, ac, sv, spi, cv, cpi };

  // Derive missing metrics safely
  if (out.sv == null && pv != null && ev != null) out.sv = ev - pv;
  if (out.cv == null && ev != null && ac != null) out.cv = ev - ac;
  if (out.spi == null && pv && pv !== 0 && ev != null) out.spi = ev / pv;
  if (out.cpi == null && ac && ac !== 0 && ev != null) out.cpi = ev / ac;

  return {
    pv: out.pv,
    ev: out.ev,
    ac: out.ac,
    sv: out.sv,
    spi: out.spi,
    cv: out.cv,
    cpi: out.cpi,
    meta: (src && src.meta) || null,
    project_id: src.project_id ?? null,
    baseline_id: src.baseline_id ?? null,
    date: src.date ?? null,
  } as EvmSummary;
}

function formatNumber(v: any): string {
  if (v == null) return "-";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  // Always show two decimals for consistency across PV/EV/AC/SV/SPI/CV/CPI
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function Kpi({ label, hint, value, badge }: { label: string; hint?: string; value: any; badge?: { text: string; tone: "red" | "yellow" | "green" } | null }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-neutral-600">{label}</div>
      {hint ? (
        <div className="mt-0.5 text-[11px] text-neutral-500 leading-snug">
          {hint}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <div className="text-base font-semibold">{formatNumber(value)}</div>
        {badge && (
          <span
            className={
              `text-[10px] px-1.5 py-0.5 rounded-full border ` +
              (badge.tone === "red"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : badge.tone === "yellow"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-[#00674F]/10 text-[#00674F] border-[#00674F]/20")
            }
          >
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}

function indexBadge(kind: "spi" | "cpi", raw: any): { text: string; tone: "red" | "yellow" | "green" } | null {
  const v = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(v)) return null;
  if (kind === "spi") {
    if (v < 1) return { text: "Behind Schedule", tone: "red" };
    if (v === 1) return { text: "On Track", tone: "yellow" };
    return { text: "Ahead Schedule", tone: "green" };
  }
  // cpi
  if (v < 1) return { text: "Over Cost", tone: "red" };
  if (v === 1) return { text: "On Budget", tone: "yellow" };
  return { text: "Under Budget", tone: "green" };
}

function isAllZero(s: EvmSummary): boolean {
  const vals = [s.pv, s.ev, s.ac, s.sv, s.spi, s.cv, s.cpi]
    .map((x) => (typeof x === "number" ? x : Number(x)))
    .filter((n) => Number.isFinite(n));
  if (vals.length === 0) return false; // no numbers to decide; keep grid
  return vals.every((n) => Math.abs(n) < 1e-9);
}

function DebugHint({ date, baseline, meta, baselineId, evmDate, loadingBaselines }: { date: string; baseline?: ProjectBaseline; meta?: any; baselineId?: number | null; evmDate?: string | null; loadingBaselines?: boolean }) {
  const start = (baseline as any)?.start_planned_base || (baseline as any)?.start_planned || null;
  const end = (baseline as any)?.end_planned_base || (baseline as any)?.end_planned || null;
  const warn = (() => {
    if (!start || !end) return null;
    const d = Date.parse(date);
    const s = Date.parse(start);
    const e = Date.parse(end);
    if (!Number.isFinite(d) || !Number.isFinite(s) || !Number.isFinite(e)) return null;
    if (d < s) return { tone: "red", text: "Tanggal sebelum awal baseline — PV wajar 0." } as const;
    if (d > e) return { tone: "yellow", text: "Tanggal melewati akhir baseline — PV mestinya penuh." } as const;
    return null;
  })();

  const windowStatus = (() => {
    if (!start || !end) return null;
    const d = Date.parse(date);
    const s = Date.parse(start);
    const e = Date.parse(end);
    if (!Number.isFinite(d) || !Number.isFinite(s) || !Number.isFinite(e)) return null;
    if (d < s) return { tone: "red", text: "Before Window" } as const;
    if (d > e) return { tone: "yellow", text: "After Window" } as const;
    return { tone: "green", text: "In Window" } as const;
  })();

  return (
    <div className="mt-3 text-[11px] text-neutral-600">
      <div>
        {loadingBaselines ? (
          <span>Memuat baseline…</span>
        ) : baseline ? (
          <span>
            Baseline: <b>{baseline.baseline_name}</b>
            {start ? ` • Start: ${start}` : ""}
            {end ? ` • End: ${end}` : ""}
            {baselineId != null ? ` • ID: ${baselineId}` : ""}
            {evmDate ? ` • Date: ${evmDate}` : ""}
            {meta?.task_count != null ? ` • Tasks: ${meta.task_count}` : ""}
            {meta?.baseline_used ? ` • Baseline Used` : ""}
          </span>
        ) : (
          <span>Baseline: Current Plan</span>
        )}
      </div>
      {windowStatus && (
        <div
          className={
            "mt-1 inline-block px-2 py-0.5 rounded border " +
            (windowStatus.tone === "red"
              ? "bg-red-50 text-red-700 border-red-200"
              : windowStatus.tone === "yellow"
              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
              : "bg-green-50 text-green-700 border-green-200")
          }
        >
          {windowStatus.text}
        </div>
      )}
      {warn && (
        <div className={
          "mt-1 inline-block px-2 py-0.5 rounded border " +
          (warn.tone === "red" ? "bg-red-50 text-red-700 border-red-200" : "bg-yellow-50 text-yellow-700 border-yellow-200")
        }>
          {warn.text}
        </div>
      )}
    </div>
  );
}

export default EvmWidget;
