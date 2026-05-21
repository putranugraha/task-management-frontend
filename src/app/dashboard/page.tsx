"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { ActivityLog } from "@/lib/api/activity-logs";
import { listActivityLogs } from "@/lib/api/activity-logs";
import ProjectStatsRow from "@/components/dashboard/ProjectStatsRow";
import TaskStatsRow from "@/components/dashboard/TaskStatsRow";
import MilestoneStatsRow from "@/components/dashboard/MilestoneStatsRow";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";

const RECENT_ACTIVITY_ROWS = 5;
const DASHBOARD_STATS_CACHE_KEY = "dashboard:overview:stats";
const DASHBOARD_ACTIVITY_CACHE_KEY = "dashboard:overview:activity";

export default function DashboardPage() {
  const { hasRole } = useAuth();
  const canViewActivityLog = hasRole("Admin");
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
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
    if (typeof window === "undefined") return;
    try {
      const rawStats = window.sessionStorage.getItem(DASHBOARD_STATS_CACHE_KEY);
      if (rawStats) {
        const parsed = JSON.parse(rawStats) as {
          projectStatsApi: typeof projectStatsApi;
          taskStatsApi: typeof taskStatsApi;
          milestoneStatsApi: typeof milestoneStatsApi;
        };
        setProjectStatsApi(parsed.projectStatsApi ?? null);
        setTaskStatsApi(parsed.taskStatsApi ?? null);
        setMilestoneStatsApi(parsed.milestoneStatsApi ?? null);
        setStatsLoading(false);
      }

      const rawActivity = window.sessionStorage.getItem(DASHBOARD_ACTIVITY_CACHE_KEY);
      if (rawActivity) {
        const parsed = JSON.parse(rawActivity) as ActivityLog[];
        setActivityLogs(Array.isArray(parsed) ? parsed : []);
        setActivityLoading(false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatsLoading(true);
      setError(null);
      setProjectStatsApi(null);
      setTaskStatsApi(null);
      setMilestoneStatsApi(null);

      try {
        const [projectsStatsRes, taskStatsRes, milestoneStatsRes] =
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

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            DASHBOARD_STATS_CACHE_KEY,
            JSON.stringify({
              projectStatsApi: projectsStatsRes
                ? {
                    total: projectsStatsRes.total ?? 0,
                    active: projectsStatsRes.active ?? 0,
                    completed: projectsStatsRes.completed ?? 0,
                  }
                : null,
              taskStatsApi: taskStatsRes
                ? {
                    total: taskStatsRes.total ?? 0,
                    completed: taskStatsRes.completed ?? 0,
                    in_progress: taskStatsRes.in_progress ?? 0,
                  }
                : null,
              milestoneStatsApi: milestoneStatsRes
                ? {
                    total: milestoneStatsRes.total ?? 0,
                    completed: milestoneStatsRes.completed ?? 0,
                    overdue: milestoneStatsRes.overdue ?? 0,
                  }
                : null,
            })
          );
        }

      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e && typeof e === "object" && "message" in e
              ? String((e as { message?: string }).message)
              : "Gagal memuat data dashboard";
          setError(message);
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canViewActivityLog) {
      setActivityLogs([]);
      setActivityLoading(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const loadActivity = async () => {
      try {
        const rows = await listActivityLogs({
          per_page: RECENT_ACTIVITY_ROWS,
        });
        if (!cancelled) {
          setActivityLogs(rows.slice(0, RECENT_ACTIVITY_ROWS));
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(
              DASHBOARD_ACTIVITY_CACHE_KEY,
              JSON.stringify(rows.slice(0, RECENT_ACTIVITY_ROWS))
            );
          }
        }
      } catch {
        if (!cancelled) {
          setActivityLogs([]);
        }
      } finally {
        if (!cancelled) {
          setActivityLoading(false);
        }
      }
    };

    setActivityLoading(true);
    timeoutId = setTimeout(() => {
      loadActivity().catch(() => {});
    }, 250);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [canViewActivityLog]);

  const projectStats = {
    total: projectStatsApi?.total ?? 0,
    active: projectStatsApi?.active ?? 0,
    completed: projectStatsApi?.completed ?? 0,
  };

  const taskTotal = taskStatsApi?.total ?? 0;
  const taskCompleted = taskStatsApi?.completed ?? 0;
  const taskInProgress = taskStatsApi?.in_progress ?? 0;
  const taskBase = taskTotal || 1;
  const taskStats = {
    total: taskTotal,
    completed: taskCompleted,
    inProgress: taskInProgress,
    totalPercent: Math.round((taskCompleted / taskBase) * 100),
    completedPercent: Math.round((taskCompleted / taskBase) * 100),
    inProgressPercent: Math.round((taskInProgress / taskBase) * 100),
  };

  const milestoneTotal = milestoneStatsApi?.total ?? 0;
  const milestoneCompleted = milestoneStatsApi?.completed ?? 0;
  const milestoneOverdue = milestoneStatsApi?.overdue ?? 0;
  const milestoneBase = milestoneTotal || 1;
  const milestoneStats = {
    total: milestoneTotal,
    completed: milestoneCompleted,
    overdue: milestoneOverdue,
    totalPercent: Math.round((milestoneCompleted / milestoneBase) * 100),
    completedPercent: Math.round((milestoneCompleted / milestoneBase) * 100),
    overduePercent: Math.round((milestoneOverdue / milestoneBase) * 100),
  };

  return (
    <div className="flex w-full min-w-0 max-w-none flex-col space-y-6">
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

      <div className="w-full min-w-0 rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
        <div className="space-y-4 border-b border-slate-100 px-6 py-6">
          <ProjectStatsRow stats={projectStats} loading={statsLoading} />
          <TaskStatsRow stats={taskStats} loading={statsLoading} />
          <MilestoneStatsRow stats={milestoneStats} loading={statsLoading} />
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
            {canViewActivityLog && (
              <Link
                href="/dashboard/activity-log"
                className="inline-flex items-center rounded-full bg-[#00674F] px-4 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#008061]"
              >
                Lihat semua
              </Link>
            )}
          </div>
          <div className="px-6 py-4">
            {activityLoading ? (
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
            ) : !canViewActivityLog ? (
              <p className="text-xs text-slate-400">
                Aktivitas terbaru hanya tersedia untuk Admin.
              </p>
            ) : activityLogs.length === 0 ? (
              <p className="text-xs text-slate-400">
                Belum ada aktivitas yang tercatat.
              </p>
            ) : (
              <div className="space-y-3">
                {activityLogs.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-slate-800">
                          {row.actor_name ?? "-"}
                        </p>
                        <p className="text-sm text-slate-600">
                          {row.event ?? "-"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          {row.log_name && (
                            <span className="rounded-full bg-white px-2 py-0.5 font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                              {row.log_name}
                            </span>
                          )}
                          {row.subject_type && (
                            <span>
                              {row.subject_type}
                              {row.subject_id ? ` #${row.subject_id}` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-medium text-slate-400">
                        {row.time ? new Date(row.time).toLocaleString() : "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
