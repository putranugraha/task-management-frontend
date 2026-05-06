"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { create as createTaskBaseline, listByTask as listTaskBaselines } from "@/lib/api/task-baselines";
import { listComments, createComment } from "@/lib/api/comments";
import { useAuth } from "@/contexts/auth-context";
import type { Comment } from "@/types/comment";
import { DetailMainCard, DetailSectionCard, DetailTwoColumnGrid } from "@/components/layout/DetailCards";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

const TaskAttachmentsSection = dynamic(
  () => import("@/components/tasks/TaskAttachmentsSection"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-10 w-full rounded-xl bg-neutral-200/60" />
        <Skeleton className="h-10 w-full rounded-xl bg-neutral-200/60" />
      </div>
    ),
  }
);

const TaskTimeTrackerSection = dynamic(
  () => import("@/components/tasks/TaskTimeTrackerSection"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <Skeleton className="h-4 w-40 rounded" />
        <Skeleton className="h-9 w-full rounded-full bg-neutral-200/60" />
      </div>
    ),
  }
);

const TaskCostEntriesSection = dynamic(
  () => import("@/components/tasks/TaskCostEntriesSection"),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <Skeleton className="h-4 w-44 rounded" />
        <Skeleton className="h-10 w-full rounded-xl bg-neutral-200/60" />
      </div>
    ),
  }
);

type Assignment = {
  user?: {
    id: number;
    name: string;
    role?: string | null;
    roles?: string[] | null;
  } | null;
  user_id?: number;
  role_on_task?: string | null;
  estimated_effort_hours?: number | null;
};
type Dependency = { type?: 'FS'|'SS'|'FF'|'SF'; lag_days?: number; depends_on?: { id: number; title: string } | null };

export default function TaskDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { state, hasRole, can } = useAuth();
  const currentUserId = useMemo(
    () => Number(state.user?.id ?? (state.user as any)?.user_id ?? 0),
    [state.user]
  );
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baselineCreating, setBaselineCreating] = useState(false);
  const [baselineMsg, setBaselineMsg] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [assignmentUserRoles, setAssignmentUserRoles] = useState<
    Record<number, string>
  >({});

  useEffect(() => {
    let mounted = true;
    async function fetchTask() {
      setLoading(true);
      setError(null);
      try {
        // Prefer including task_baselines when backend supports include
        const baseUrl = `/api/tasks/${id}`;
        const endpoints = [
          `${baseUrl}?include=task_baselines,baseline`,
          `${baseUrl}?include=task_baselines`,
          baseUrl,
        ];
        let payload: any = null;
        for (const ep of endpoints) {
          try {
            const res = await apiRequest<any>('GET', ep);
            const p = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
            payload = p;
            break;
          } catch (e: any) {
            if (e?.response?.status === 404) continue;
            throw e;
          }
        }
        // If backend didn’t include baselines, try listing by task id as a fallback
        if (payload && !Array.isArray(payload?.task_baselines)) {
          try {
            const list = await listTaskBaselines(id);
            payload.task_baselines = list;
          } catch {}
        }
        if (mounted) setData(payload);
      } catch (e: any) {
        setError(e?.message ?? 'Gagal memuat task');
      } finally {
        setLoading(false);
      }
    }
    fetchTask();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    async function fetchComments() {
      if (!id) return;
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        const list = await listComments("Task", id);
        if (active) {
          setComments(list);
        }
      } catch (e: any) {
        if (active) {
          setCommentsError(e?.message ?? "Gagal memuat komentar");
        }
      } finally {
        if (active) {
          setCommentsLoading(false);
        }
      }
    }
    fetchComments();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const list: any[] = Array.isArray((data as any)?.assignments)
      ? (data as any).assignments
      : [];
    if (!list.length) return;

    (async () => {
      const updates: Record<number, string> = {};
      const seen = new Set<number>();

      for (const a of list) {
        const uid = Number(
          a?.user?.id ?? a?.user_id ?? (a as any)?.id ?? 0
        );
        if (!Number.isFinite(uid) || uid <= 0 || seen.has(uid)) continue;
        seen.add(uid);

        if (assignmentUserRoles[uid]) continue;

        let role = "";
        const user = a?.user as any;

        if (user) {
          if (user.role && String(user.role).trim()) {
            role = String(user.role).trim();
          } else if (Array.isArray(user.roles) && user.roles.length > 0) {
            const first = user.roles[0];
            const name =
              typeof first === "string" ? first : first?.name ?? "";
            role = String(name || "").trim();
          }
        }

        if (!role && uid === currentUserId) {
          const fromPrimary = state.primary_role ?? null;
          const fromList =
            Array.isArray(state.roles) && state.roles.length
              ? state.roles[0]
              : null;
          const picked = fromPrimary || fromList;
          if (picked) {
            role = String(picked).trim();
          }
        }

        if (!role) {
          try {
            const res = await apiRequest<any>("GET", `/api/users/${uid}`);
            const payload =
              res && typeof res === "object" && "data" in (res as any)
                ? (res as any).data
                : res;
            let r = payload?.role ?? null;
            if (!r && Array.isArray(payload?.roles) && payload.roles.length) {
              const first = payload.roles[0];
              r =
                typeof first === "string"
                  ? first
                  : (first as any)?.name ?? null;
            }
            if (r) {
              role = String(r).trim();
            }
          } catch {
            // ignore failures; leave role empty
          }
        }

        if (role) {
          updates[uid] = role;
        }
      }

      if (Object.keys(updates).length > 0) {
        setAssignmentUserRoles((prev) => ({ ...prev, ...updates }));
      }
    })();
  }, [data, currentUserId, state.primary_role, state.roles, assignmentUserRoles]);

  async function handleCreateBaseline() {
    setBaselineMsg(null);
    try {
      setBaselineCreating(true);
      // Prepare optional snapshot fields to satisfy stricter backends
      const startBase: string | null = (data?.start_planned ?? null) || null;
      const endBase: string | null = (data?.end_planned ?? null) || null;
      const durationBase: number | null = (startBase && endBase)
        ? (Math.max(0, Math.round((Date.parse(endBase) - Date.parse(startBase)) / (24 * 60 * 60 * 1000))) + 1)
        : null;
      const weight = 1.0;

      // Try to link to latest project baseline if backend requires baseline_id
      let baselineId: number | undefined = undefined;
      const projectId = (data?.project?.id ?? data?.project_id) as number | undefined;
      if (projectId) {
        try {
          const res = await apiRequest<any[] | { data: any[] }>('GET', `/api/project-baselines?project_id=${encodeURIComponent(String(projectId))}`);
          const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
          // Sort newest taken_at first as in project page
          list.sort((a: any, b: any) => {
            const ta = a.taken_at ? Date.parse(a.taken_at) : 0;
            const tb = b.taken_at ? Date.parse(b.taken_at) : 0;
            if (tb !== ta) return tb - ta;
            return (b.id ?? 0) - (a.id ?? 0);
          });
          if (list.length > 0) baselineId = Number(list[0].id);
        } catch {}
      }

      await createTaskBaseline(id, {
        start_planned_base: startBase,
        end_planned_base: endBase,
        duration_planned_base: durationBase as any,
        weight: weight as any,
        baseline_id: baselineId as any,
      } as any);
      setBaselineMsg('Task Baseline created successfully.');
      // Refresh task detail to include latest baselines
      try {
        const res = await apiRequest<any>('GET', `/api/tasks/${id}?include=task_baselines,baseline`);
        const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
        // Fallback include fetch if not provided
        if (!Array.isArray(payload?.task_baselines)) {
          try {
            const list = await listTaskBaselines(id);
            payload.task_baselines = list;
          } catch {}
        }
        setData(payload);
      } catch {}
    } catch (e: any) {
      const status = e?.response?.status;
      const errs = e?.response?.data?.errors;
      let msg = e?.response?.data?.message || e?.message || 'Failed to create Task Baseline.';
      if (errs && typeof errs === 'object') {
        const firstKey = Object.keys(errs)[0];
        const val = errs[firstKey];
        const detail = Array.isArray(val) ? val.join(', ') : String(val ?? '');
        if (detail) msg = `${msg}: ${detail}`;
      }
      setBaselineMsg(`${msg}${status ? ` (HTTP ${status})` : ''}`);
      console.error('Create Task Baseline error:', e?.response || e);
    } finally {
      setBaselineCreating(false);
    }
  }

  async function handleSubmitComment(e: any) {
    e.preventDefault();
    const content = newComment.trim();
    if (!content || !id || postingComment) return;
    if (!currentUserId) {
      setCommentsError("User yang aktif tidak dikenali, komentar tidak dapat dikirim.");
      return;
    }
    setPostingComment(true);
    setCommentsError(null);
    try {
      const created = await createComment({
        entity_type: "Task",
        entity_id: id,
        user_id: currentUserId,
        content,
      });
      // Pastikan komentar baru punya nama user di FE
      const withUser = {
        ...created,
        user: created.user ?? (state.user
          ? {
              id: currentUserId,
              name: state.user.name,
              email: (state.user as any).email ?? "",
            }
          : created.user),
      };
      setNewComment("");
      setComments((prev) => [withUser, ...prev]);
    } catch (e: any) {
      setCommentsError(e?.message ?? "Gagal mengirim komentar");
    } finally {
      setPostingComment(false);
    }
  }

  if (error) {
    return (
      <div className="w-full space-y-4">
        <div className="px-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/tasks">Tasks</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Error</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!data && !loading) {
    return (
      <div className="w-full space-y-4">
        <div className="px-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/tasks">Tasks</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Not found</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="rounded-[24px] border border-slate-100 bg-white/95 px-4 py-3 text-sm text-neutral-600 shadow-sm">
          Task tidak ditemukan.
        </div>
      </div>
    );
  }

  const isLoading = false;
  const title = data?.title ?? `Task #${id}`;
  const projectName = data?.project?.name ?? data?.project_id ?? (isLoading ? "Loading project…" : "Task detail overview");
  const status = data?.status ?? (isLoading ? "Loading…" : "To Do");
  const priority = data?.priority ?? (isLoading ? "Loading…" : "Medium");
  const percentComplete = Number(data?.percent_complete ?? 0);

  const ass: Assignment[] = Array.isArray(data?.assignments) ? data.assignments : [];
  const deps: Dependency[] = Array.isArray(data?.dependencies) ? data.dependencies : [];

  const canEditTask = useMemo(
    () =>
      hasRole("Admin") ||
      hasRole("Manager") ||
      can("mengubah tugas"),
    [hasRole, can]
  );

  const canCreateTaskBaseline = useMemo(
    () =>
      hasRole("Admin") ||
      hasRole("Manager") ||
      can("membuat project"),
    [hasRole, can]
  );

  return (
    <div className="w-full space-y-6">
      <div className="px-1">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/tasks">Tasks</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Top layout: two equal-width cards (summary + details) */}
      <div className="grid gap-8 min-w-0 w-full lg:grid-cols-2">
        {/* Summary aside (neutral, same tone as other cards) */}
        <aside className="min-w-0 flex h-full flex-col justify-between gap-6 rounded-3xl border border-slate-100 bg-white/95 p-7 text-slate-900 shadow-[0_4px_25px_rgba(15,23,42,0.08)]">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="w-full rounded-full bg-slate-100">
                <div className="h-1 rounded-full bg-[#00674F]" style={{ width: `${percentComplete || 0}%` }} />
              </div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-slate-900">
                Task Overview
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-lg font-bold text-slate-700">
                {getInitials(title, data?.project?.name ?? projectName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xl font-semibold text-slate-900">{title}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {data?.project?.name ? `Project: ${data.project.name}` : projectName}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#00674F]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#00674F]">
                {status}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                {priority}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                {percentComplete}% complete
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">Start Planned</div>
                <div className="font-semibold mt-0.5">
                  {isLoading ? "Loading…" : data?.start_planned ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">End Planned</div>
                <div className="font-semibold mt-0.5">
                  {isLoading ? "Loading…" : data?.end_planned ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">Start Actual</div>
                <div className="font-semibold mt-0.5">
                  {isLoading ? "Loading…" : data?.start_actual ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">End Actual</div>
                <div className="font-semibold mt-0.5">
                  {isLoading ? "Loading…" : data?.end_actual ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">Created At</div>
                <div className="font-semibold mt-0.5">
                  {isLoading ? "Loading…" : data?.created_at ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500">Updated At</div>
                <div className="font-semibold mt-0.5">
                  {isLoading ? "Loading…" : data?.updated_at ?? "-"}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-600">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Tip</p>
            <p className="text-sm leading-relaxed">
              Gunakan halaman ini untuk memastikan status, tanggal, dan progres task selalu terupdate.
            </p>
          </div>
        </aside>

        {/* Detail fields + actions card */}
        <div className="flex h-full min-w-0 w-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h2 className="text-lg font-semibold text-slate-900 truncate">
                Task Details
              </h2>
              <p className="text-sm text-slate-500">
                Atur informasi utama untuk task ini.
              </p>
            </div>
          </div>

          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            <Row
              label="Project"
              value={isLoading ? "Loading…" : (data?.project?.name ?? data?.project_id ?? "-")}
            />
            <Row
              label="Milestone"
              value={isLoading ? "Loading…" : (data?.milestone?.name ?? data?.milestone_id ?? "-")}
            />
            <Row
              label="Start Planned"
              value={isLoading ? "Loading…" : (data?.start_planned ?? "-")}
            />
            <Row
              label="End Planned"
              value={isLoading ? "Loading…" : (data?.end_planned ?? "-")}
            />
            <Row
              label="Start Actual"
              value={isLoading ? "Loading…" : (data?.start_actual ?? "-")}
            />
            <Row
              label="End Actual"
              value={isLoading ? "Loading…" : (data?.end_actual ?? "-")}
            />
            <Row
              label="Created At"
              value={isLoading ? "Loading…" : (data?.created_at ?? "-")}
            />
            <Row
              label="Updated At"
              value={isLoading ? "Loading…" : (data?.updated_at ?? "-")}
            />
          </div>

          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            <Row
              label="Budget Cost"
              value={isLoading ? "Loading..." : formatIdr(data?.budget_cost)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditTask && (
              <a
                href={`/dashboard/tasks/${id}/edit`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
              >
                Edit Task
              </a>
            )}
            {canCreateTaskBaseline && (
              <button
                type="button"
                onClick={handleCreateBaseline}
                disabled={baselineCreating}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {baselineCreating ? "Creating baseline…" : "Create Task Baseline"}
              </button>
            )}
            <button
              type="button"
              onClick={() => history.back()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              Back
            </button>
            {!!baselineMsg && (
              <span className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-600">
                {baselineMsg}
              </span>
            )}
          </div>
        </div>
      </div>

      {!isLoading && data && (
        <div className="flex flex-col gap-6">
          <DetailTwoColumnGrid className="order-1">
            <DetailSectionCard>
              <h3 className="text-sm font-semibold mb-2 text-slate-800">Assignments</h3>
              <div className="border rounded-lg overflow-hidden">
                {ass.length === 0 ? (
                  <div className="p-3 text-sm text-neutral-500">No assignments</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-neutral-50 text-neutral-700">
                      <tr>
                        <th className="text-left font-medium px-3 py-2 border-b">User</th>
                        <th className="text-left font-medium px-3 py-2 border-b">Role</th>
                        <th className="text-left font-medium px-3 py-2 border-b">Effort (h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ass.map((a, idx) => {
                        const user = a.user;
                        const uid = Number(user?.id ?? a.user_id ?? 0);
                        const name = user?.name ?? String(a.user_id ?? "");
                        const roleFromMap =
                          Number.isFinite(uid) && uid > 0
                            ? assignmentUserRoles[uid]
                            : "";
                        const fallbackRoleFromUser =
                          (user?.role && String(user.role).trim()) ||
                          (Array.isArray(user?.roles) &&
                          user.roles.length > 0
                            ? String(
                                typeof user.roles[0] === "string"
                                  ? user.roles[0]
                                  : (user.roles[0] as any)?.name ?? ""
                              ).trim()
                            : "");
                        const role =
                          (roleFromMap ||
                            fallbackRoleFromUser ||
                            (a.role_on_task ?? "")).trim() || "-";
                        const eff = a.estimated_effort_hours ?? null;
                        return (
                          <tr key={idx} className="hover:bg-neutral-50">
                            <td className="px-3 py-2 border-t">{name || "-"}</td>
                            <td className="px-3 py-2 border-t">{role || "-"}</td>
                            <td className="px-3 py-2 border-t">{typeof eff === "number" ? eff : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </DetailSectionCard>

          <DetailSectionCard>
            <h3 className="text-sm font-semibold mb-2 text-slate-800">Dependencies</h3>
              <div className="border rounded-lg overflow-hidden">
                {deps.length === 0 ? (
                  <div className="p-3 text-sm text-neutral-500">No dependencies</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-neutral-50 text-neutral-700">
                      <tr>
                        <th className="text-left font-medium px-3 py-2 border-b">Depends On</th>
                        <th className="text-left font-medium px-3 py-2 border-b">Type</th>
                        <th className="text-left font-medium px-3 py-2 border-b">Lag (days)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deps.map((d, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="px-3 py-2 border-t">{d.depends_on?.title ?? "-"}</td>
                          <td className="px-3 py-2 border-t">{d.type ?? "FS"}</td>
                          <td className="px-3 py-2 border-t">{typeof d.lag_days === "number" ? d.lag_days : 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </DetailSectionCard>
          </DetailTwoColumnGrid>

          <DetailSectionCard className="order-3">
            <h3 className="text-sm font-semibold mb-2 text-slate-800">Comments</h3>
            <div className="space-y-3">
              <form onSubmit={handleSubmitComment} className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Tambahkan komentar
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                  placeholder="Tulis komentar terkait task ini…"
                />
                {commentsError && (
                  <p className="text-xs text-rose-500">{commentsError}</p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={postingComment || !newComment.trim()}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-[#00674F] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-[#00523f] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {postingComment ? "Mengirim…" : "Kirim komentar"}
                  </button>
                </div>
              </form>
              <div className="mt-3 border-t border-slate-100 pt-3 space-y-2 max-h-80 overflow-y-auto">
                {commentsLoading ? (
                  <div className="text-sm text-neutral-500">Memuat komentar…</div>
                ) : comments.length === 0 ? (
                  <div className="text-sm text-neutral-500">
                    Belum ada komentar. Jadilah yang pertama.
                  </div>
                ) : (
                  comments.map((c) => {
                    const author = c.user?.name || "Pengguna";
                    let when = "";
                    if (c.created_at) {
                      const d = new Date(c.created_at);
                      when = Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
                    }
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm text-slate-700"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-800">
                            {author}
                          </span>
                          {when && (
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                              {when}
                            </span>
                          )}
                        </div>
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {c.content}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DetailSectionCard>

          <DetailSectionCard className="order-2">
            <h3 className="text-sm font-semibold mb-2 text-slate-800">Baselines</h3>
            <div className="border rounded-lg overflow-hidden">
              {(!Array.isArray(data.task_baselines) || data.task_baselines.length === 0) ? (
                <div className="p-3 text-sm text-neutral-500">No baselines yet.</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-neutral-700">
                    <tr>
                      <th className="text-left font-medium px-3 py-2 border-b">Start (Base)</th>
                      <th className="text-left font-medium px-3 py-2 border-b">End (Base)</th>
                      <th className="text-left font-medium px-3 py-2 border-b">Duration</th>
                      <th className="text-left font-medium px-3 py-2 border-b">Linked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.task_baselines.map((b: any) => (
                      <tr key={b.id} className="hover:bg-neutral-50">
                        <td className="px-3 py-2 border-t">{b.start_planned_base ?? "-"}</td>
                        <td className="px-3 py-2 border-t">{b.end_planned_base ?? "-"}</td>
                        <td className="px-3 py-2 border-t">
                          {typeof b.duration_planned_base === "number" ? `${b.duration_planned_base} days` : "-"}
                        </td>
                        <td className="px-3 py-2 border-t">
                          {b.baseline?.baseline_name ? `Project: ${b.baseline.baseline_name}` : "Free snapshot"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </DetailSectionCard>

          <DetailTwoColumnGrid className="mb-4 order-4">
            <DetailSectionCard>
              <TaskAttachmentsSection
                taskId={id}
                initialPercent={percentComplete}
                onPercentChange={(value) =>
                  setData((prev: any | null) =>
                    prev ? { ...prev, percent_complete: value } : prev
                  )
                }
                onStatusChange={(status) =>
                  setData((prev: any | null) =>
                    prev ? { ...prev, status } : prev
                  )
                }
              />
            </DetailSectionCard>

            <DetailSectionCard>
              <TaskTimeTrackerSection
                taskId={id}
                initialStatus={data.status}
                onStatusChange={(status) =>
                  setData((prev: any | null) => (prev ? { ...prev, status } : prev))
                }
              />
            </DetailSectionCard>
          </DetailTwoColumnGrid>

          <DetailSectionCard className="order-5">
            <TaskCostEntriesSection taskId={id} />
          </DetailSectionCard>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-inner flex items-center">
        <span className="truncate w-full whitespace-nowrap">{value}</span>
      </div>
    </div>
  );
}

function formatIdr(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getInitials(name?: string | null, fallback?: string | null) {
  const source = (name ?? fallback ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? "").join("").toUpperCase();
}
