"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";
import type { ActivityLog } from "@/lib/api/activity-logs";
import TaskStatsRow from "@/components/dashboard/TaskStatsRow";
import MilestoneStatsRow from "@/components/dashboard/MilestoneStatsRow";
import { Skeleton } from "@/components/ui/skeleton";
import { RowsPerPageControl } from "@/components/dashboard/RowsPerPageControl";
import DataTable from "./users/data-table";
import type { Column } from "./users/columns";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

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

  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [activityPage, setActivityPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [projectsRes, tasksRes, milestonesRes, activityRes] =
          await Promise.all([
            apiRequest<MaybePaginated<Project>>("GET", "/api/projects"),
            apiRequest<MaybePaginated<Task>>("GET", "/api/tasks"),
            apiRequest<MaybePaginated<Milestone>>("GET", "/api/milestones"),
            apiRequest<ActivityLog[] | { data: ActivityLog[] }>(
              "GET",
              "/api/activity-logs?per_page=50"
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

  const taskStats = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    tasks.forEach((t) => {
      const status = (t.status || "").toLowerCase();
      const isCompleted =
        /(\b|^)(done|completed?)($|\b)/.test(status) &&
        !status.includes("incomplete");
      const isInProgress =
        status.includes("in progress") ||
        status === "progress" ||
        status.includes("ongoing");
      if (isCompleted) completed += 1;
      else if (isInProgress) inProgress += 1;
    });
    return {
      total: tasks.length,
      completed,
      inProgress,
    };
  }, [tasks]);

  const milestoneStats = useMemo(() => {
    const total = milestones.length;
    let completed = 0;
    let overdue = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    milestones.forEach((m) => {
      const status = (m.status || "").toLowerCase();
      if (status === "completed") {
        completed += 1;
        return;
      }
      if (m.due_planned) {
        const due = new Date(m.due_planned);
        if (due < today && status !== "completed") {
          overdue += 1;
        }
      }
    });

    return { total, completed, overdue };
  }, [milestones]);

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
    return sorted.slice(0, 20);
  }, [activityLogs]);

  const totalActivityPages = Math.max(
    1,
    Math.ceil(recentActivity.length / rowsPerPage || 1)
  );

  useEffect(() => {
    if (activityPage > totalActivityPages) {
      setActivityPage(totalActivityPages);
    }
  }, [activityPage, totalActivityPages]);

  const activityStartIndex = (activityPage - 1) * rowsPerPage;
  const paginatedActivity = useMemo(
    () =>
      recentActivity.slice(
        activityStartIndex,
        activityStartIndex + rowsPerPage
      ),
    [recentActivity, activityStartIndex, rowsPerPage]
  );

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
        {/* Row: Task & Milestone stats */}
        <div className="space-y-4 border-b border-slate-100 px-6 py-6">
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
            ) : paginatedActivity.length === 0 ? (
              <p className="text-xs text-slate-400">
                Belum ada aktivitas yang tercatat.
              </p>
            ) : (
              <DataTable<ActivityLog>
                columns={LATEST_ACTIVITY_COLUMNS}
                data={paginatedActivity}
                loading={false}
                emptyText="Belum ada aktivitas yang tercatat."
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-3 text-xs text-slate-600">
          <span>
            Showing {paginatedActivity.length === 0 ? 0 : activityStartIndex + 1}{" "}
            to{" "}
            {paginatedActivity.length === 0
              ? 0
              : activityStartIndex + paginatedActivity.length}{" "}
            of {recentActivity.length} log
            {recentActivity.length === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <RowsPerPageControl
              value={rowsPerPage}
              onChange={(next) => setRowsPerPage(next)}
              options={[5, 10, 20]}
              label="Rows"
            />
            <div className="flex items-center gap-1 text-slate-500">
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                onClick={() => setActivityPage(1)}
                disabled={activityPage === 1}
              >
                «
              </button>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                onClick={() =>
                  setActivityPage((p) => Math.max(1, p - 1))
                }
                disabled={activityPage === 1}
              >
                ‹
              </button>
              <span className="px-2 text-xs font-semibold text-slate-500">
                Page {activityPage} of {totalActivityPages}
              </span>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                onClick={() =>
                  setActivityPage((p) =>
                    Math.min(totalActivityPages, p + 1)
                  )
                }
                disabled={activityPage === totalActivityPages}
              >
                ›
              </button>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                onClick={() => setActivityPage(totalActivityPages)}
                disabled={activityPage === totalActivityPages}
              >
                »
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
