"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { create as createTaskBaseline, listByTask as listTaskBaselines } from "@/lib/api/task-baselines";
import TaskAttachmentsSection from "@/components/tasks/TaskAttachmentsSection";
import TaskTimeTrackerSection from "@/components/tasks/TaskTimeTrackerSection";
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

type Assignment = { user?: { id: number; name: string } | null; user_id?: number; role_on_task?: string | null; estimated_effort_hours?: number | null };
type Dependency = { type?: 'FS'|'SS'|'FF'|'SF'; lag_days?: number; depends_on?: { id: number; title: string } | null };

export default function TaskDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baselineCreating, setBaselineCreating] = useState(false);
  const [baselineMsg, setBaselineMsg] = useState<string | null>(null);

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

  if (loading) {
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
                <BreadcrumbPage>Loading…</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur p-6">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-64 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 mt-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
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

  if (!data) {
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

  const ass: Assignment[] = Array.isArray(data?.assignments) ? data.assignments : [];
  const deps: Dependency[] = Array.isArray(data?.dependencies) ? data.dependencies : [];

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
              <BreadcrumbPage>{data.title ?? `Task #${id}`}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <DetailMainCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900 truncate">{data.title}</h1>
            <p className="text-sm text-slate-500">
              {data.project?.name ? (
                <span>Project: {data.project.name}</span>
              ) : (
                <span>Task detail overview</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              {data.status ?? "To Do"}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              {data.priority ?? "Medium"} priority
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              {Number(data.percent_complete ?? 0)}% complete
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 grid-cols-1 md:grid-cols-2">
          <Row label="Project" value={data.project?.name ?? data.project_id ?? "-"} />
          <Row label="Milestone" value={data.milestone?.name ?? data.milestone_id ?? "-"} />
          <Row label="Start Planned" value={data.start_planned ?? "-"} />
          <Row label="End Planned" value={data.end_planned ?? "-"} />
          <Row label="Created At" value={data.created_at ?? "-"} />
          <Row label="Updated At" value={data.updated_at ?? "-"} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href={`/dashboard/tasks/${id}/edit`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
          >
            Edit Task
          </a>
          <button
            type="button"
            onClick={handleCreateBaseline}
            disabled={baselineCreating}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {baselineCreating ? "Creating baseline…" : "Create Task Baseline"}
          </button>
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
      </DetailMainCard>

      <DetailTwoColumnGrid>
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
                    const name = a.user?.name ?? String(a.user_id ?? "");
                    const role = (a.role_on_task ?? "").trim();
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

      <DetailSectionCard>
        <h3 className="text-sm font-semibold mb-2 text-slate-800">Baselines</h3>
        <div className="border rounded-lg overflow-hidden">
          {(!Array.isArray(data?.task_baselines) || data.task_baselines.length === 0) ? (
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

      <DetailTwoColumnGrid className="mb-4">
        <DetailSectionCard>
          <TaskAttachmentsSection taskId={id} />
        </DetailSectionCard>

        <DetailSectionCard>
          <TaskTimeTrackerSection taskId={id} />
        </DetailSectionCard>
      </DetailTwoColumnGrid>
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
