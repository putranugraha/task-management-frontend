"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";
import type { ActivityLog } from "@/lib/api/activity-logs";
import ProjectStatsRow from "@/components/dashboard/ProjectStatsRow";
import TaskStatsRow from "@/components/dashboard/TaskStatsRow";
import MilestoneStatsRow from "@/components/dashboard/MilestoneStatsRow";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import DataTable from "./users/data-table";
import type { Column } from "./users/columns";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

const PROJECTS_PER_PAGE = 50;
const TASKS_PER_PAGE = 50;
const MILESTONES_PER_PAGE = 50;
const ACTIVITY_LOGS_PER_PAGE = 10;

const LATEST_ACTIVITY_COLUMNS: Column<ActivityLog>[] = [
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

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [hiddenProjectKeys, setHiddenProjectKeys] = useState<string[]>([]);
  const [hiddenTaskKeys, setHiddenTaskKeys] = useState<string[]>([]);
  const [taskStatsApi, setTaskStatsApi] = useState<{
    total: number;
    completed: number;
    in_progress: number;
  } | null>(null);
  const [milestoneStatsApi, setMilestoneStatsApi] = useState<{
    total: number;
    completed: number;
    overdue: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const [taskStatsRes, milestoneStatsRes] = await Promise.all([
          apiRequest<{
            total: number;
            completed: number;
            in_progress: number;
          }>("GET", "/api/tasks/stats").catch(() => null),
          apiRequest<{
            total: number;
            completed: number;
            overdue: number;
          }>("GET", "/api/milestones/stats").catch(() => null),
        ]);

        if (cancelled) return;

        if (taskStatsRes) {
          setTaskStatsApi({
            total: taskStatsRes.total ?? 0,
            completed: taskStatsRes.completed ?? 0,
            in_progress: taskStatsRes.in_progress ?? 0,
          });
        } else {
          setTaskStatsApi(null);
        }

        if (milestoneStatsRes) {
          setMilestoneStatsApi({
            total: milestoneStatsRes.total ?? 0,
            completed: milestoneStatsRes.completed ?? 0,
            overdue: milestoneStatsRes.overdue ?? 0,
          });
        } else {
          setMilestoneStatsApi(null);
        }
      } catch {
        if (cancelled) return;
        setTaskStatsApi(null);
        setMilestoneStatsApi(null);
      }
    };

    (async () => {
      setLoading(true);
      setError(null);
      setTaskStatsApi(null);
      setMilestoneStatsApi(null);

      try {
        const [projectsRes, tasksRes, milestonesRes, activityRes] =
          await Promise.all([
            apiRequest<MaybePaginated<Project>>(
              "GET",
              `/api/projects?per_page=${PROJECTS_PER_PAGE}`
            ),
            apiRequest<MaybePaginated<Task>>(
              "GET",
              `/api/tasks?per_page=${TASKS_PER_PAGE}`
            ),
            apiRequest<MaybePaginated<Milestone>>(
              "GET",
              `/api/milestones?per_page=${MILESTONES_PER_PAGE}`
            ),
            apiRequest<ActivityLog[] | { data: ActivityLog[] }>(
              "GET",
              `/api/activity-logs?per_page=${ACTIVITY_LOGS_PER_PAGE}`
            ),
          ]);

        if (cancelled) return;

        const normalize = <T,>(res: MaybePaginated<T>): T[] =>
          Array.isArray(res) ? res : ((res as any).data ?? []);

        setProjects(normalize(projectsRes));
        setTasks(normalize(tasksRes));
        setMilestones(normalize(milestonesRes));
        setActivityLogs(
          Array.isArray(activityRes)
            ? activityRes
            : ((activityRes as any).data ?? [])
        );

        // Fetch stats in background so dashboard content
        // tidak ikut nunggu query agregasi yang lebih berat.
        fetchStats();
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Gagal memuat data dashboard");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const projectStats = useMemo(() => {
    const total = projects.length;
    let active = 0;
    let completed = 0;

    projects.forEach((p) => {
      const status = (p.status || "").toLowerCase();
      const isCompleted =
        /(\b|^)(done|completed?)($|\b)/.test(status) ||
        status === "closed" ||
        status === "finished";
      const isActive =
        status.includes("active") ||
        status.includes("in progress") ||
        status.includes("ongoing") ||
        status === "running";

      if (isCompleted) completed += 1;
      else if (isActive) active += 1;
    });

    return { total, active, completed };
  }, [projects]);

  const projectStatusConfig: ChartConfig = {
    planned: { label: "Planned", color: "var(--chart-1)" },
    active: { label: "Active", color: "var(--chart-2)" },
    completed: { label: "Completed", color: "var(--chart-3)" },
    onhold: { label: "On Hold", color: "var(--chart-4)" },
    other: { label: "Other", color: "var(--chart-5)" },
  };

  const projectStatusSeries = useMemo(() => {
    const buckets: Record<string, { key: string; label: string; count: number }> =
      {
        planned: { key: "planned", label: "Planned", count: 0 },
        active: { key: "active", label: "Active", count: 0 },
        completed: { key: "completed", label: "Completed", count: 0 },
        onhold: { key: "onhold", label: "On Hold", count: 0 },
        other: { key: "other", label: "Other", count: 0 },
      };

    projects.forEach((p) => {
      const s = (p.status || "").toLowerCase();
      let key: keyof typeof buckets = "other";
      if (s.includes("plan")) key = "planned";
      else if (
        s.includes("active") ||
        s.includes("in progress") ||
        s.includes("ongoing") ||
        s === "running"
      )
        key = "active";
      else if (
        /(\b|^)(done|completed?)($|\b)/.test(s) ||
        s === "closed" ||
        s === "finished"
      )
        key = "completed";
      else if (s.includes("hold") || s.includes("pending")) key = "onhold";

      buckets[key].count += 1;
    });

    return Object.values(buckets).filter((b) => b.count > 0);
  }, [projects]);

  const taskStats = useMemo(() => {
    const totalFromRows = tasks.length;
    let completedFromRows = 0;
    let inProgressFromRows = 0;

    tasks.forEach((t) => {
      const s = (t.status || "").toLowerCase();
      const isCompleted =
        /(\b|^)(done|completed?)($|\b)/.test(s) && !s.includes("incomplete");
      const isInProgress =
        s.includes("in progress") || s === "progress" || s.includes("ongoing");

      if (isCompleted) {
        completedFromRows += 1;
      } else if (
        !s.includes("incomplete") &&
        (s.includes("done") || s.includes("completed") || s === "complete")
      ) {
        completedFromRows += 1;
      } else if (isInProgress) {
        inProgressFromRows += 1;
      }
    });

    const total = taskStatsApi?.total ?? totalFromRows;
    const completed = taskStatsApi?.completed ?? completedFromRows;
    const inProgress = taskStatsApi?.in_progress ?? inProgressFromRows;

    const base = total || totalFromRows || 1;
    const completedPercent = Math.round((completed / base) * 100);
    const inProgressPercent = Math.round((inProgress / base) * 100);
    const totalPercent = completedPercent;

    return {
      total,
      completed,
      inProgress,
      totalPercent,
      completedPercent,
      inProgressPercent,
    };
  }, [tasks, taskStatsApi]);

  const milestoneStats = useMemo(() => {
    const totalFromRows = milestones.length;
    let completedFromRows = 0;
    let overdueFromRows = 0;

    milestones.forEach((m) => {
      const s = (m.status || "").toLowerCase();
      if (s.includes("completed") || s === "complete") {
        completedFromRows += 1;
      }
      if (s.includes("overdue")) {
        overdueFromRows += 1;
      }
    });

    const total = milestoneStatsApi?.total ?? totalFromRows;
    const completed = milestoneStatsApi?.completed ?? completedFromRows;
    const overdue = milestoneStatsApi?.overdue ?? overdueFromRows;

    const base = total || totalFromRows || 1;
    const completedPercent = Math.round((completed / base) * 100);
    const overduePercent = Math.round((overdue / base) * 100);
    const totalPercent = completedPercent;

    return {
      total,
      completed,
      overdue,
      totalPercent,
      completedPercent,
      overduePercent,
    };
  }, [milestones, milestoneStatsApi]);

  const importantTasks = useMemo(() => {
    const isDone = (status: string | null | undefined) => {
      const s = (status || "").toLowerCase();
      return (
        /(\b|^)(done|completed?)($|\b)/.test(s) && !s.includes("incomplete")
      );
    };

    const upcoming = tasks.filter((t) => !isDone(t.status));

    const withDue = upcoming.map((t) => {
      const dateStr = t.end_planned || t.start_planned || t.created_at;
      const time = dateStr ? Date.parse(dateStr) : Number.POSITIVE_INFINITY;
      return { task: t, time };
    });

    withDue.sort((a, b) => a.time - b.time);

    return withDue.slice(0, 5).map((x) => x.task);
  }, [tasks]);

  const upcomingMilestones = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today);
    weekAhead.setDate(weekAhead.getDate() + 7);

    const isDone = (status: string | null | undefined) =>
      (status || "").toLowerCase() === "completed";

    const upcoming = milestones
      .filter((m) => m.due_planned && !isDone(m.status))
      .map((m) => {
        const due = new Date(m.due_planned as string);
        return { m, due };
      })
      .filter(({ due }) => due >= today && due <= weekAhead);

    upcoming.sort((a, b) => a.due.getTime() - b.due.getTime());

    return upcoming.slice(0, 5).map((x) => x.m);
  }, [milestones]);

  const recentActivity = useMemo(() => {
    const sorted = [...activityLogs].sort((a, b) => {
      const ta = a.time ? Date.parse(a.time) : 0;
      const tb = b.time ? Date.parse(b.time) : 0;
      return tb - ta;
    });
    return sorted.slice(0, 5);
  }, [activityLogs]);

  const taskStatusConfig: ChartConfig = {
    todo: { label: "To Do", color: "var(--chart-1)" },
    inprogress: { label: "In Progress", color: "var(--chart-4)" },
    done: { label: "Done", color: "var(--chart-2)" },
    other: { label: "Other", color: "var(--chart-5)" },
  };

  const taskStatusSeries = useMemo(() => {
    const buckets: Record<string, { key: string; label: string; count: number }> =
      {
        todo: { key: "todo", label: "To Do", count: 0 },
        inprogress: { key: "inprogress", label: "In Progress", count: 0 },
        done: { key: "done", label: "Done", count: 0 },
        other: { key: "other", label: "Other", count: 0 },
      };

    tasks.forEach((t) => {
      const s = (t.status || "").toLowerCase();
      let key: keyof typeof buckets = "other";

      if (s === "to do" || s === "todo" || s.includes("backlog")) {
        key = "todo";
      } else {
        const isInProgress =
          s.includes("in progress") || s === "progress" || s.includes("ongoing");
        const isCompletedStrict =
          /(\b|^)(done|completed?)($|\b)/.test(s) && !s.includes("incomplete");
        const isCompletedLoose =
          !s.includes("incomplete") &&
          (s.includes("done") || s.includes("completed") || s === "complete");

        if (isInProgress) {
          key = "inprogress";
        } else if (isCompletedStrict || isCompletedLoose) {
          key = "done";
        }
      }

      buckets[key].count += 1;
    });

    const sampleTotal =
      buckets.todo.count +
      buckets.inprogress.count +
      buckets.done.count +
      buckets.other.count;
    const targetTotal = taskStats.total;

    if (sampleTotal > 0 && targetTotal > 0 && sampleTotal !== targetTotal) {
      const orderedKeys: (keyof typeof buckets)[] = [
        "todo",
        "inprogress",
        "done",
        "other",
      ];
      let allocated = 0;

      orderedKeys.forEach((key, index) => {
        const bucket = buckets[key];
        if (index === orderedKeys.length - 1) {
          bucket.count = Math.max(0, targetTotal - allocated);
        } else {
          const scaled = Math.round((bucket.count / sampleTotal) * targetTotal);
          bucket.count = scaled;
          allocated += scaled;
        }
      });
    }

    return Object.values(buckets).filter((b) => b.count > 0);
  }, [tasks, taskStats]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Overview Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Ringkasan singkat proyek, tasks, dan milestone untuk membantu kamu
          melihat kondisi terbaru.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      {/* Main overview card: stats + lists + activity */}
      <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
        {/* Row: Project, Task & Milestone stats */}
        <div className="space-y-4 border-b border-slate-100 px-6 py-6">
          <ProjectStatsRow stats={projectStats} loading={loading} />
          <TaskStatsRow stats={taskStats} loading={loading} />
          <MilestoneStatsRow stats={milestoneStats} loading={loading} />
        </div>

        {/* Row: Important tasks & upcoming milestones */}
        <div className="grid gap-6 min-w-0 w-full border-b border-slate-100 px-6 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div>
            <div className="mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Important Tasks
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Tasks yang belum selesai, diurutkan dari yang paling dekat
                deadlinenya.
              </p>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40 rounded" />
                      <Skeleton className="h-3 w-32 rounded" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : importantTasks.length === 0 ? (
              <p className="text-xs text-slate-400">
                Tidak ada task penting yang perlu diperhatikan saat ini.
              </p>
            ) : (
              <div className="space-y-3">
                {importantTasks.map((t) => {
                  const status = t.status ?? "To Do";
                  const projectName = (t as any).project?.name ?? "";
                  const dateLabel = t.end_planned || t.start_planned;
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {t.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {projectName && (
                            <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {projectName}
                            </span>
                          )}
                          {dateLabel && (
                            <span className="text-[11px]">
                              Due {dateLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                        {status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Upcoming Milestones (7 hari)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Milestone yang akan jatuh tempo dalam 7 hari ke depan.
              </p>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40 rounded" />
                      <Skeleton className="h-3 w-32 rounded" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                ))}
              </div>
            ) : upcomingMilestones.length === 0 ? (
              <p className="text-xs text-slate-400">
                Tidak ada milestone yang jatuh tempo dalam 7 hari ke depan.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingMilestones.map((m) => {
                  const projectName = (m as any).project?.name ?? "";
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {m.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {projectName && (
                            <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {projectName}
                            </span>
                          )}
                          {m.due_planned && (
                            <span className="text-[11px]">
                              Due {m.due_planned}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                        {m.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Row: Overview charts */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Overview Charts
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Snapshot visual status project dan tasks kamu.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Project status chart */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Project Status
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Proporsi project berdasarkan status terkini.
                  </p>
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  {projects.length} projects
                </span>
              </div>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="mx-auto h-32 w-32 rounded-full" />
                  <div className="flex flex-wrap justify-center gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-4 w-20 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              ) : projects.length === 0 || projectStatusSeries.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Belum ada data project.
                </p>
              ) : (
                (() => {
                  const activeSeries = projectStatusSeries.filter(
                    (s) => s.count > 0
                  );
                  const totalProjects = projects.length || 1;

                  const visibleSeriesRaw = activeSeries.filter(
                    (s) => !hiddenProjectKeys.includes(s.key)
                  );
                  const visibleSeries =
                    visibleSeriesRaw.length > 0 ? visibleSeriesRaw : activeSeries;

                  return (
                    <ChartContainer
                      config={projectStatusConfig}
                      className="flex items-center gap-4"
                    >
                      <div className="relative mx-auto h-32 w-32 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Pie
                              data={visibleSeries}
                              dataKey="count"
                              nameKey="label"
                              innerRadius={40}
                              outerRadius={60}
                              paddingAngle={4}
                            >
                              {visibleSeries.map((entry) => (
                                <Cell
                                  key={entry.key}
                                  fill={`var(--color-${entry.key})`}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-1 flex-col gap-1 text-[11px]">
                        {projectStatusSeries.map((s) => {
                          const pct = Math.round((s.count / totalProjects) * 100);
                          const hidden = hiddenProjectKeys.includes(s.key);
                          return (
                            <button
                              type="button"
                            key={s.key}
                            onClick={() => {
                              const activeKeys = projectStatusSeries
                                .filter((x) => x.count > 0)
                                .map((x) => x.key);

                              const isHidden = hiddenProjectKeys.includes(s.key);
                              const nextHidden = isHidden
                                ? hiddenProjectKeys.filter((k) => k !== s.key)
                                : [...hiddenProjectKeys, s.key];

                              const hiddenActiveCount = activeKeys.filter((k) =>
                                nextHidden.includes(k)
                              ).length;

                              const allActiveHidden =
                                hiddenActiveCount >= activeKeys.length &&
                                activeKeys.length > 0;

                              setHiddenProjectKeys(
                                allActiveHidden ? [] : nextHidden
                              );
                            }}
                            className={[
                              "flex items-center justify-between gap-2 rounded-full px-2.5 py-1 transition",
                              hidden
                                ? "bg-slate-50/40 text-slate-400"
                                : "bg-slate-50 text-slate-600",
                            ].join(" ")}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  backgroundColor: `var(--color-${s.key})`,
                                }}
                              />
                              <span className="font-medium text-slate-700">
                                {s.label}
                              </span>
                            </div>
                              <span className="text-slate-500">
                                {s.count} ({pct}%)
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </ChartContainer>
                  );
                })()
              )}
            </div>

            {/* Task status chart */}
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Task Status
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Distribusi tasks berdasarkan status pengerjaan.
                  </p>
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  {taskStats.total} tasks
                </span>
              </div>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="mx-auto h-32 w-32 rounded-full" />
                  <div className="flex flex-wrap justify-center gap-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-4 w-20 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              ) : tasks.length === 0 || taskStatusSeries.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Belum ada data task.
                </p>
              ) : (
                (() => {
                  const activeSeries = taskStatusSeries.filter(
                    (s) => s.count > 0
                  );
                  const totalTasks = taskStats.total || 1;

                  const visibleSeriesRaw = activeSeries.filter(
                    (s) => !hiddenTaskKeys.includes(s.key)
                  );
                  const visibleSeries =
                    visibleSeriesRaw.length > 0 ? visibleSeriesRaw : activeSeries;

                  return (
                    <ChartContainer
                      config={taskStatusConfig}
                      className="flex items-center gap-4"
                    >
                      <div className="relative mx-auto h-32 w-32 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Pie
                              data={visibleSeries}
                              dataKey="count"
                              nameKey="label"
                              innerRadius={40}
                              outerRadius={60}
                              paddingAngle={4}
                            >
                              {visibleSeries.map((entry) => (
                                <Cell
                                  key={entry.key}
                                  fill={`var(--color-${entry.key})`}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-1 flex-col gap-1 text-[11px]">
                        {taskStatusSeries.map((s) => {
                          const pct = Math.round(
                            (s.count / totalTasks) * 100
                          );
                          const hidden = hiddenTaskKeys.includes(s.key);
                          return (
                            <button
                              type="button"
                              key={s.key}
                              onClick={() => {
                                const activeKeys = taskStatusSeries
                                  .filter((x) => x.count > 0)
                                  .map((x) => x.key);

                                const isHidden = hiddenTaskKeys.includes(s.key);
                                const nextHidden = isHidden
                                  ? hiddenTaskKeys.filter((k) => k !== s.key)
                                  : [...hiddenTaskKeys, s.key];

                                const hiddenActiveCount = activeKeys.filter(
                                  (k) => nextHidden.includes(k)
                                ).length;

                                const allActiveHidden =
                                  hiddenActiveCount >= activeKeys.length &&
                                  activeKeys.length > 0;

                                setHiddenTaskKeys(
                                  allActiveHidden ? [] : nextHidden
                                );
                              }}
                              className={[
                                "flex items-center justify-between gap-2 rounded-full px-2.5 py-1 transition",
                                hidden
                                  ? "bg-slate-50/40 text-slate-400"
                                  : "bg-slate-50 text-slate-600",
                              ].join(" ")}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{
                                    backgroundColor: `var(--color-${s.key})`,
                                  }}
                                />
                                <span className="font-medium text-slate-700">
                                  {s.label}
                                </span>
                              </div>
                              <span className="text-slate-500">
                                {s.count} ({pct}%)
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </ChartContainer>
                  );
                })()
              )}
            </div>
          </div>
        </div>

        {/* Row: Latest activity */}
        <div className="border-t border-slate-100">
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Latest Activity
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Beberapa aktivitas terakhir dari Activity Log.
            </p>
          </div>
          <a
            href="/dashboard/activity-log"
            className="inline-flex items-center rounded-full bg-[#00674F] px-4 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#008061]"
          >
            Lihat semua
          </a>
        </div>
          <div className="px-6 py-4">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                  >
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40 rounded" />
                      <Skeleton className="h-3 w-48 rounded" />
                    </div>
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-xs text-slate-400">
                Belum ada aktivitas yang tercatat.
              </p>
            ) : (
              <DataTable<ActivityLog>
                columns={LATEST_ACTIVITY_COLUMNS}
                data={recentActivity}
                loading={false}
                emptyText="Belum ada aktivitas yang tercatat."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
