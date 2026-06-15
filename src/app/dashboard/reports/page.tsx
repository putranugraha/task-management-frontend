"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import type { KpiSnapshot } from "@/types/kpi-snapshot";
import type { ReportingPeriod } from "@/types/reporting-period";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  groupKeyForPeriodDate,
  type PeriodGranularity,
} from "@/lib/reporting/as-of-periods";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";
import { useAuth } from "@/contexts/auth-context";

type TaskStats = {
  total: number;
  completed: number;
  in_progress: number;
};

type MilestoneStats = {
  total: number;
  completed: number;
  overdue: number;
};

const EvmWidget = dynamic(
  () => import("@/components/evm/EvmWidget").then((m) => m.EvmWidget),
  {
    ssr: false,
    loading: () => (
      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
        Memuat ringkasan EVM…
      </div>
    ),
  }
);

const EvmCostWidget = dynamic(() => import("@/components/evm/EvmCostWidget"), {
  ssr: false,
  loading: () => (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
      Memuat ringkasan EVM (IDR)…
    </div>
  ),
});

type ProjectSummary = {
  id: number;
  name: string;
};

type KpiSnapshotWithPeriod = KpiSnapshot & {
  period_label: string;
};

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ReportsPageContent() {
  const { can } = useAuth();
  const canPrintReport = can("mencetak laporan");

  const { showToast } = useToast();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );

  const today = useMemo(() => new Date(), []);
  const startOfMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
    [today]
  );

  const [dateFrom, setDateFrom] = useState<string>(toISODate(startOfMonth));
  const [dateTo, setDateTo] = useState<string>(toISODate(today));

  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [taskStatsLoading, setTaskStatsLoading] = useState(false);
  const [taskStatsError, setTaskStatsError] = useState<string | null>(null);

  const [milestoneStats, setMilestoneStats] = useState<MilestoneStats | null>(
    null
  );
  const [milestoneStatsLoading, setMilestoneStatsLoading] = useState(false);
  const [milestoneStatsError, setMilestoneStatsError] = useState<
    string | null
  >(null);

  const [reportingPeriods, setReportingPeriods] = useState<ReportingPeriod[]>(
    []
  );
  const [kpiSnapshots, setKpiSnapshots] = useState<KpiSnapshotWithPeriod[]>([]);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const [avgCycleTime, setAvgCycleTime] = useState<number | null>(null);
  const [kpiGranularity, setKpiGranularity] =
    useState<PeriodGranularity>("daily");

  // Load projects for dropdown
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const res = await apiRequest<
          Project[] | { data: Project[]; meta?: unknown }
        >("GET", `/api/projects?per_page=50`);
        const arr = Array.isArray(res) ? res : (res as any)?.data ?? [];
        const mapped: ProjectSummary[] = arr.map((p: any) => ({
          id: Number(p.id),
          name: String(p.name ?? `Project #${p.id}`),
        }));
        if (!cancelled) {
          setProjects(mapped);
          if (mapped.length > 0 && selectedProjectId == null) {
            setSelectedProjectId(mapped[0].id);
          }
        }
      } catch (e: any) {
        const msg = e?.message ?? "Gagal memuat daftar project";
        setProjectsError(msg);
        showToast({
          variant: "error",
          title: "Gagal memuat projects",
          description: msg,
        });
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load stats when project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setTaskStats(null);
      setMilestoneStats(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setTaskStatsLoading(true);
      setMilestoneStatsLoading(true);
      setTaskStatsError(null);
      setMilestoneStatsError(null);
      try {
        const params = new URLSearchParams();
        params.set("project_id", String(selectedProjectId));
        const [tRes, mRes] = await Promise.all([
          apiRequest<TaskStats>("GET", `/api/tasks/stats?${params.toString()}`)
            .catch(() => null),
          apiRequest<MilestoneStats>(
            "GET",
            `/api/milestones/stats?${params.toString()}`
          ).catch(() => null),
        ]);

        if (cancelled) return;

        if (tRes) {
          setTaskStats({
            total: tRes.total ?? 0,
            completed: tRes.completed ?? 0,
            in_progress: tRes.in_progress ?? 0,
          });
        } else {
          setTaskStats(null);
        }

        if (mRes) {
          setMilestoneStats({
            total: mRes.total ?? 0,
            completed: mRes.completed ?? 0,
            overdue: mRes.overdue ?? 0,
          });
        } else {
          setMilestoneStats(null);
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message ?? "Gagal memuat ringkasan";
        setTaskStatsError(msg);
        setMilestoneStatsError(msg);
      } finally {
        if (!cancelled) {
          setTaskStatsLoading(false);
          setMilestoneStatsLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  // Load KPI snapshots and reporting periods
  useEffect(() => {
    if (!selectedProjectId) {
      setReportingPeriods([]);
      setKpiSnapshots([]);
      setAvgCycleTime(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setKpiLoading(true);
      setKpiError(null);
      try {
        const [periodsRes, snapsRes, avgRes] = await Promise.all([
          apiRequest<ReportingPeriod[] | { data: ReportingPeriod[] }>(
            "GET",
            `/api/projects/${encodeURIComponent(
              String(selectedProjectId)
            )}/reporting-periods`
          ).catch(() => []),
          apiRequest<
            KpiSnapshot[] | { data: KpiSnapshot[] } | KpiSnapshot | { data: KpiSnapshot }
          >(
            "GET",
            `/api/projects/${encodeURIComponent(
              String(selectedProjectId)
            )}/kpi-snapshots`
          ).catch(() => [] as any),
          apiRequest<{ average_cycle_time_days?: number } | any>(
            "GET",
            `/api/projects/${encodeURIComponent(
              String(selectedProjectId)
            )}/kpi-snapshots/average-cycle-time`
          ).catch(() => null),
        ]);

        if (cancelled) return;

        const periods: ReportingPeriod[] = Array.isArray(periodsRes)
          ? periodsRes
          : (periodsRes as any)?.data ?? [];

        let rawSnaps: KpiSnapshot[] = [];
        const snapsPayload: any = snapsRes;
        if (Array.isArray(snapsPayload)) {
          rawSnaps = snapsPayload as KpiSnapshot[];
        } else if (
          snapsPayload &&
          typeof snapsPayload === "object" &&
          "data" in snapsPayload
        ) {
          const inner = (snapsPayload as any).data;
          if (Array.isArray(inner)) {
            rawSnaps = inner;
          } else if (inner) {
            rawSnaps = [inner as KpiSnapshot];
          }
        } else if (snapsPayload) {
          rawSnaps = [snapsPayload as KpiSnapshot];
        }

        const periodMap = new Map<number, ReportingPeriod>();
        periods.forEach((p) => {
          periodMap.set(Number(p.id), p);
        });

        const withLabel: KpiSnapshotWithPeriod[] = rawSnaps.map((s) => {
          const rp =
            s.reporting_period ??
            periodMap.get(Number((s as any).period_id)) ??
            null;
          const label =
            (rp && (rp as any).period_date) ||
            (s as any).period_date ||
            (rp && (rp as any).id
              ? `Periode #${(rp as any).id}`
              : `Periode #${s.period_id}`);
          return {
            ...(s as any),
            period_label: String(label ?? `Periode #${s.period_id}`),
          } as KpiSnapshotWithPeriod;
        });

        withLabel.sort((a, b) => {
          const da = (a.reporting_period as any)?.period_date ?? a.created_at;
          const db = (b.reporting_period as any)?.period_date ?? b.created_at;
          const ta = da ? Date.parse(da) : 0;
          const tb = db ? Date.parse(db) : 0;
          return ta - tb;
        });

        let avg: number | null = null;
        if (avgRes && typeof avgRes === "object") {
          if ("average_cycle_time_days" in avgRes) {
            const v = (avgRes as any).average_cycle_time_days;
            const n = typeof v === "number" ? v : Number(v ?? NaN);
            avg = Number.isFinite(n) ? n : null;
          }
        }

        setReportingPeriods(periods);
        setKpiSnapshots(withLabel);
        setAvgCycleTime(avg);
      } catch (e: any) {
        if (cancelled) return;
        const msg = e?.message ?? "Gagal memuat KPI snapshots";
        setKpiError(msg);
      } finally {
        if (!cancelled) {
          setKpiLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  const selectedProject =
    selectedProjectId && projects.length
      ? projects.find((p) => p.id === selectedProjectId) ?? null
      : null;

  const displayKpiSnapshots = useMemo(() => {
    if (!kpiSnapshots.length) return [];

    const periodIdToDate = new Map<number, string>();
    for (const p of reportingPeriods) {
      if (Number.isFinite(p.id) && p.period_date) {
        periodIdToDate.set(Number(p.id), String(p.period_date).trim());
      }
    }

    if (kpiGranularity === "daily") {
      return kpiSnapshots.slice().sort((a, b) => {
        const ad = String(a.reporting_period?.period_date ?? periodIdToDate.get(Number(a.period_id ?? 0)) ?? "");
        const bd = String(b.reporting_period?.period_date ?? periodIdToDate.get(Number(b.period_id ?? 0)) ?? "");
        if (ad !== bd) return ad.localeCompare(bd);
        return Number(a.id ?? 0) - Number(b.id ?? 0);
      });
    }

    type Row = KpiSnapshotWithPeriod & { __date: string; __group: string };
    const rows: Row[] = [];
    for (const s of kpiSnapshots) {
      const fromRel = String(s.reporting_period?.period_date ?? "").trim();
      const fromMap = periodIdToDate.get(Number(s.period_id ?? 0)) || "";
      const date = fromRel || fromMap;
      if (!date) continue;
      const group = groupKeyForPeriodDate(date, kpiGranularity);
      rows.push({ ...s, __date: date, __group: group });
    }

    const best = new Map<string, Row>();
    for (const r of rows) {
      const prev = best.get(r.__group);
      if (!prev) {
        best.set(r.__group, r);
        continue;
      }
      if (r.__date > prev.__date) best.set(r.__group, r);
      else if (
        r.__date === prev.__date &&
        Number(r.id ?? 0) > Number(prev.id ?? 0)
      ) {
        best.set(r.__group, r);
      }
    }

    const reps: Row[] = Array.from(best.values());
    // keep ascending sort so "latest" is last (same as previous behavior)
    reps.sort((a, b) => a.__date.localeCompare(b.__date));

    return reps.map((r) => {
      const { __date, __group, ...rest } = r;
      return {
        ...(rest as KpiSnapshotWithPeriod),
        period_label: `${__group} (as of ${__date})`,
      };
    });
  }, [kpiSnapshots, reportingPeriods, kpiGranularity]);

  const latestKpi = useMemo(() => {
    if (!displayKpiSnapshots.length) return null;
    return displayKpiSnapshots[displayKpiSnapshots.length - 1];
  }, [displayKpiSnapshots]);

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    try {
      window.print();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between print:block">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ringkasan performa proyek, KPI snapshot, dan EVM. Gunakan filter
            project di bawah ini lalu cetak laporan.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-600">
              Project
            </label>
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00674F]"
              value={selectedProjectId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedProjectId(v ? Number(v) : null);
              }}
              disabled={projectsLoading}
            >
              <option value="">
                {projectsLoading ? "Memuat projects…" : "Pilih project"}
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {projectsError && (
              <p className="text-xs text-red-600">{projectsError}</p>
            )}
          </div>
          <div className="flex gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">
                Dari
              </label>
              <input
                type="date"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00674F]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-600">
                Sampai
              </label>
              <input
                type="date"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00674F]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          {canPrintReport && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F] print:hidden"
              >
                Cetak laporan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Ringkasan Tugas
              </h2>
              <p className="text-xs text-slate-500">
                Total tugas, selesai, dan in progress pada project ini.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {taskStatsLoading ? (
              <>
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </>
            ) : taskStatsError ? (
              <div className="col-span-3 text-xs text-red-600 text-left">
                {taskStatsError}
              </div>
            ) : !taskStats ? (
              <div className="col-span-3 text-xs text-slate-400 text-left">
                Pilih project untuk melihat ringkasan tugas.
              </div>
            ) : (
              <>
                <SummaryStatCard
                  label="Total"
                  value={taskStats.total}
                  tone="neutral"
                />
                <SummaryStatCard
                  label="Selesai"
                  value={taskStats.completed}
                  tone="success"
                />
                <SummaryStatCard
                  label="In Progress"
                  value={taskStats.in_progress}
                  tone="info"
                />
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Ringkasan Milestone
              </h2>
              <p className="text-xs text-slate-500">
                Total milestone, selesai, dan overdue pada project ini.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {milestoneStatsLoading ? (
              <>
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </>
            ) : milestoneStatsError ? (
              <div className="col-span-3 text-xs text-red-600 text-left">
                {milestoneStatsError}
              </div>
            ) : !milestoneStats ? (
              <div className="col-span-3 text-xs text-slate-400 text-left">
                Pilih project untuk melihat ringkasan milestone.
              </div>
            ) : (
              <>
                <SummaryStatCard
                  label="Total"
                  value={milestoneStats.total}
                  tone="neutral"
                />
                <SummaryStatCard
                  label="Selesai"
                  value={milestoneStats.completed}
                  tone="success"
                />
                <SummaryStatCard
                  label="Overdue"
                  value={milestoneStats.overdue}
                  tone="danger"
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI snapshot section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              KPI Snapshot Project
            </h2>
            <p className="text-xs text-slate-500">
              Rekap performa tugas per periode pelaporan (snapshot KPI).
            </p>
          </div>
          {selectedProject && (
            <div className="text-xs text-slate-500">
              Project:{" "}
              <span className="font-semibold text-slate-700">
                {selectedProject.name}
              </span>
              <span className="mx-2 text-slate-400">•</span>
              Periode laporan: {dateFrom || "-"} s/d {dateTo || "-"}
            </div>
          )}
        </div>

        {selectedProject && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold">Tampilan:</span>
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={kpiGranularity}
              onChange={(e) =>
                setKpiGranularity(e.target.value as PeriodGranularity)
              }
            >
              <option value="daily">Harian (Daily)</option>
              <option value="weekly">Mingguan (Weekly)</option>
              <option value="monthly">Bulanan (Monthly)</option>
            </select>
            {kpiGranularity !== "daily" && (
              <span className="text-[11px] text-slate-500">
                Menampilkan snapshot terakhir per periode (as-of).
              </span>
            )}
          </div>
        )}

        <div className="mt-4">
          {kpiLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : kpiError ? (
            <div className="text-sm text-red-600">{kpiError}</div>
          ) : !selectedProject ? (
            <div className="text-sm text-slate-400">
              Pilih project terlebih dahulu untuk melihat KPI snapshot.
            </div>
          ) : !displayKpiSnapshots.length ? (
            <div className="text-sm text-slate-400">
              Belum ada snapshot KPI untuk project ini.
            </div>
          ) : (
            <>
              {latestKpi && (
                <div className="mb-4 grid gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 md:grid-cols-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Snapshot Terbaru
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-800">
                      {latestKpi.period_label}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Completion Rate
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-800">
                      {(() => {
                        const total = Number(latestKpi.tasks_total ?? 0);
                        const done = Number(latestKpi.tasks_done ?? 0);
                        if (!total) return "0%";
                        const pct = Math.round((done / total) * 100);
                        return `${pct}% (${done}/${total})`;
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Rata-rata Cycle Time
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-800">
                      {avgCycleTime != null
                        ? `${avgCycleTime.toFixed(2)} hari`
                        : `${Number(
                            latestKpi.avg_cycle_time_days ?? 0
                          ).toFixed(2)} hari`}
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-1 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">Periode</th>
                      <th className="px-3 py-2 text-right">Tasks Total</th>
                      <th className="px-3 py-2 text-right">Tasks Done</th>
                      <th className="px-3 py-2 text-right">Overdue</th>
                      <th className="px-3 py-2 text-right">
                        Avg Cycle Time (hari)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayKpiSnapshots.map((s) => (
                      <tr
                        key={`${s.id}-${s.period_id}`}
                        className="rounded-xl border border-slate-100 bg-white align-middle shadow-sm"
                      >
                        <td className="px-3 py-2 text-slate-800">
                          {s.period_label}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {s.tasks_total ?? 0}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {s.tasks_done ?? 0}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {s.overdue_count ?? 0}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(s.avg_cycle_time_days ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* EVM section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">EVM</h2>
            <p className="text-xs text-slate-500">
              Menampilkan 2 mode: schedule performance (effort-based) dan cost-based (IDR).
            </p>
          </div>
          {selectedProject && (
            <div className="text-xs text-slate-500">
              Project:{" "}
              <span className="font-semibold text-slate-700">
                {selectedProject.name}
              </span>
            </div>
          )}
        </div>
        <div className="mt-4">
          {!selectedProject ? (
            <div className="text-sm text-slate-400">
              Pilih project untuk melihat ringkasan EVM.
            </div>
          ) : (
            <div className="space-y-6">
              <EvmWidget key={`evm-${selectedProject.id}`} projectId={selectedProject.id} />
              <EvmCostWidget key={`evm-cost-${selectedProject.id}`} projectId={selectedProject.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { loading, allowed } = usePermissionGuard([
    "melihat laporan pribadi",
    "melihat laporan project",
    "mencetak laporan",
  ]);

  if (!loading && !allowed) {
    return <Forbidden />;
  }

  if (loading) {
    return null;
  }

  return <ReportsPageContent />;
}

type SummaryTone = "neutral" | "success" | "info" | "danger";

function SummaryStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: SummaryTone;
}) {
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 border-sky-100"
      : tone === "danger"
      ? "bg-rose-50 text-rose-700 border-rose-100"
      : "bg-slate-50 text-slate-700 border-slate-100";

  return (
    <div
      className={`rounded-xl border px-3 py-2 text-center shadow-sm ${toneClass}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
