"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { ActivityLog } from "@/lib/api/activity-logs";
import ProjectStatsRow from "@/components/dashboard/ProjectStatsRow";
import TaskStatsRow from "@/components/dashboard/TaskStatsRow";
import MilestoneStatsRow from "@/components/dashboard/MilestoneStatsRow";
import { Skeleton } from "@/components/ui/skeleton";
import DataTable from "./users/data-table";
import type { Column } from "./users/columns";

const ACTIVITY_LOGS_PER_PAGE = 10;
const RECENT_ACTIVITY_ROWS = 5;

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
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [projectStatsApi, setProjectStatsApi] = useState<{
    total: number;
    active: number;
    completed: number;
  } | null>(null);
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

    (async () => {
      setLoading(true);
      setError(null);
      setProjectStatsApi(null);
      setTaskStatsApi(null);
      setMilestoneStatsApi(null);

      try {
        const [projectsStatsRes, taskStatsRes, milestoneStatsRes, activityRes] =
          await Promise.all([
            apiRequest<{
              total: number;
              active: number;
              completed: number;
            }>("GET", "/api/projects/stats").catch(() => null),
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
            apiRequest<ActivityLog[] | { data: ActivityLog[] }>(
              "GET",
              `/api/activity-logs?per_page=${ACTIVITY_LOGS_PER_PAGE}`
            ),
          ]);

        if (cancelled) return;

        setProjectStatsApi(
          projectsStatsRes
            ? {
                total: projectsStatsRes.total ?? 0,
                active: projectsStatsRes.active ?? 0,
                completed: projectsStatsRes.completed ?? 0,
              }
            : null
        );
        setTaskStatsApi(
          taskStatsRes
            ? {
                total: taskStatsRes.total ?? 0,
                completed: taskStatsRes.completed ?? 0,
                in_progress: taskStatsRes.in_progress ?? 0,
              }
            : null
        );
        setMilestoneStatsApi(
          milestoneStatsRes
            ? {
                total: milestoneStatsRes.total ?? 0,
                completed: milestoneStatsRes.completed ?? 0,
                overdue: milestoneStatsRes.overdue ?? 0,
              }
            : null
        );

        setActivityLogs(
          Array.isArray(activityRes)
            ? activityRes
            : ((activityRes as any).data ?? [])
        );
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
    return {
      total: projectStatsApi?.total ?? 0,
      active: projectStatsApi?.active ?? 0,
      completed: projectStatsApi?.completed ?? 0,
    };
  }, [projectStatsApi]);

  const taskStats = useMemo(() => {
    const total = taskStatsApi?.total ?? 0;
    const completed = taskStatsApi?.completed ?? 0;
    const inProgress = taskStatsApi?.in_progress ?? 0;

    const base = total || 1;
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
  }, [taskStatsApi]);

  const milestoneStats = useMemo(() => {
    const total = milestoneStatsApi?.total ?? 0;
    const completed = milestoneStatsApi?.completed ?? 0;
    const overdue = milestoneStatsApi?.overdue ?? 0;

    const base = total || 1;
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
  }, [milestoneStatsApi]);

  const recentActivity = useMemo(() => {
    const sorted = [...activityLogs].sort((a, b) => {
      const ta = a.time ? Date.parse(a.time) : 0;
      const tb = b.time ? Date.parse(b.time) : 0;
      return tb - ta;
    });
    return sorted.slice(0, RECENT_ACTIVITY_ROWS);
  }, [activityLogs]);

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Overview Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Dashboard dibuat ringan: menampilkan ringkasan dan aktivitas terbaru.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
        <div className="space-y-4 border-b border-slate-100 px-6 py-6">
          <ProjectStatsRow stats={projectStats} loading={loading} />
          <TaskStatsRow stats={taskStats} loading={loading} />
          <MilestoneStatsRow stats={milestoneStats} loading={loading} />
        </div>

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
