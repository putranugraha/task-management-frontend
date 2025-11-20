"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { create as createTaskBaseline, listByTask as listTaskBaselines } from "@/lib/api/task-baselines";
import { listByProject } from "@/lib/api/milestones";
import { listByProject as listTasksByProject } from "@/lib/api/tasks";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";
import type { ProjectBaseline } from "@/types/project-baseline";
import EvmWidget from "@/components/evm/EvmWidget";
import TaskProgressEditor from "@/components/tasks/TaskProgressEditor";
import TimeEntryForm from "@/components/time/TimeEntryForm";
import { totalByTask as totalHoursByTask } from "@/lib/api/time-entries";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal } from "lucide-react";

type ProjectDetail = {
  id: number;
  name: string;
  client_name: string;
  value_amount: number | string;
  scope: string | null;
  objective: string | null;
  division_owner?: { id: number; name: string; email?: string } | null;
  start_planned: string | null;
  end_planned: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params?.id);

  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestonesError, setMilestonesError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [openTaskIds, setOpenTaskIds] = useState<Record<number, boolean>>({});
  // Baselines state
  const [baselines, setBaselines] = useState<ProjectBaseline[]>([]);
  const [baselinesLoading, setBaselinesLoading] = useState(false);
  const [baselinesError, setBaselinesError] = useState<string | null>(null);
  const [baselineModalOpen, setBaselineModalOpen] = useState(false);
  const [baselineSaving, setBaselineSaving] = useState(false);
  const [baselineForm, setBaselineForm] = useState<{ baseline_name: string; note: string }>(() => ({ baseline_name: "", note: "" }));
  const [baselineFormErr, setBaselineFormErr] = useState<string | null>(null);
  // Task baseline per-row loading state
  const [taskBaselineLoading, setTaskBaselineLoading] = useState<Record<number, boolean>>({});
  // EVM reload signal after saving progress/time
  const [evmReloadKey, setEvmReloadKey] = useState(0);
  // Total hours per task (loaded lazily when details open or after saving time)
  const [taskTotalHours, setTaskTotalHours] = useState<Record<number, number>>({});
  const [taskTotalHoursLoading, setTaskTotalHoursLoading] = useState<Record<number, boolean>>({});
  const [taskTotalHoursError, setTaskTotalHoursError] = useState<Record<number, string | null>>({});
  // Local UI tab state
  const [activeTab, setActiveTab] = useState<"overview" | "evm" | "milestones" | "baselines" | "tasks">("overview");
  // Current user id for time entries (from localStorage user object)
  const currentUser = (typeof window !== 'undefined') ? (() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  })() : null;
  const currentUserId = Number((currentUser?.id ?? currentUser?.user_id) ?? 0);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<any>("GET", `/api/projects/${id}`);
        const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
        const p = Array.isArray(payload) ? payload[0] : payload;
        const owner = p.division_owner || p.owner || p.project_owner || null;
        const ownerObj = owner ? { id: Number(owner.id ?? owner.user_id ?? 0), name: owner.name ?? owner.full_name ?? owner.email ?? 'Unknown', email: owner.email } : null;
        const detail: ProjectDetail = {
          id: Number(p.id),
          name: p.name,
          client_name: p.client_name ?? p.client ?? '-',
          value_amount: typeof p.value_amount === 'string' ? p.value_amount : Number(p.value_amount ?? 0),
          scope: p.scope ?? null,
          objective: p.objective ?? null,
          division_owner: ownerObj,
          start_planned: p.start_planned ?? null,
          end_planned: p.end_planned ?? null,
          status: p.status ?? 'Planned',
          created_at: p.created_at,
          updated_at: p.updated_at,
        };
        if (mounted) setData(detail);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404) {
          setNotFound(true);
        } else {
          setError(e?.message ?? 'Gagal memuat project');
        }
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { mounted = false; };
  }, [id]);

  // Fetch project baselines
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!id) return;
      setBaselinesLoading(true);
      setBaselinesError(null);
      try {
        const res = await apiRequest<ProjectBaseline[] | { data: ProjectBaseline[] }>("GET", `/api/project-baselines?project_id=${encodeURIComponent(String(id))}`);
        const arr = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        arr.sort((a: any, b: any) => {
          const ta = a.taken_at ? Date.parse(a.taken_at) : 0;
          const tb = b.taken_at ? Date.parse(b.taken_at) : 0;
          if (tb !== ta) return tb - ta;
          return (b.id ?? 0) - (a.id ?? 0);
        });
        if (mounted) setBaselines(arr as ProjectBaseline[]);
      } catch (e: any) {
        setBaselinesError(e?.message ?? 'Failed to load baselines');
      } finally {
        setBaselinesLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!id) return;
      setMilestonesLoading(true);
      setMilestonesError(null);
      try {
        const list = await listByProject(id);
        if (mounted) {
          const arr = Array.isArray(list) ? list : [];
          arr.sort((a, b) => {
            const da = a.due_planned ? Date.parse(a.due_planned) : Number.POSITIVE_INFINITY;
            const db = b.due_planned ? Date.parse(b.due_planned) : Number.POSITIVE_INFINITY;
            if (da !== db) return da - db;
            const ca = a.created_at ? Date.parse(a.created_at) : 0;
            const cb = b.created_at ? Date.parse(b.created_at) : 0;
            if (ca !== cb) return ca - cb;
            return (a.id ?? 0) - (b.id ?? 0);
          });
          setMilestones(arr);
        }
      } catch (e: any) {
        setMilestonesError(e?.message ?? 'Gagal memuat milestones');
      } finally {
        setMilestonesLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [id]);

  // Fetch project tasks once, then group by milestone at render time
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!id) return;
      setTasksLoading(true);
      setTasksError(null);
      try {
        const list = await listTasksByProject(id);
        if (mounted) {
          const arr = Array.isArray(list) ? list : [];
          // Stabilize order: by status, then created_at, then id
          arr.sort((a, b) => {
            const sa = a.status || '';
            const sb = b.status || '';
            if (sa !== sb) return sa.localeCompare(sb);
            const ca = a.created_at ? Date.parse(a.created_at) : 0;
            const cb = b.created_at ? Date.parse(b.created_at) : 0;
            if (ca !== cb) return ca - cb;
            return (a.id ?? 0) - (b.id ?? 0);
          });
          setTasks(arr);
        }
      } catch (e: any) {
        setTasksError(e?.message ?? 'Gagal memuat tasks proyek');
      } finally {
        setTasksLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [id]);

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
                <BreadcrumbLink href="/dashboard/projects">Projects</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Loading…</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur p-6">
          <div className="space-y-3">
            <Skeleton className="h-8 w-64 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
          </div>
          <div className="mt-6 grid gap-3 grid-cols-1 md:grid-cols-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-4 w-1/3 rounded" />
          </div>
        </div>
        <div className="rounded-[24px] border border-transparent bg-white/95 shadow-[0_18px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 p-4">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }
  if (notFound) return <div className="text-neutral-500">Project not found</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-neutral-500">No project data</div>;

  const currency = (v: number | string) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (Number.isFinite(n)) {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
      } catch {
        return `IDR ${Math.round(n).toLocaleString()}`;
      }
    }
    return String(v ?? '');
  };

  // Helper flags for enabling baseline creation only when usable dates exist
  const hasAnyTask = Array.isArray(tasks) && tasks.length > 0;
  const hasStartDate = tasks.some((t) => !!t.start_planned);
  const hasEndDate = tasks.some((t) => !!t.end_planned);
  const canBaseline = (milestones.length > 0) && hasAnyTask && hasStartDate && hasEndDate;
  // Preview baseline window for the modal
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const toISODate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const startPreview = (() => {
    const starts = tasks.map(t => t.start_planned).filter((v): v is string => !!v);
    if (starts.length === 0) return null;
    const min = Math.min(...starts.map(s => Date.parse(s)));
    return Number.isFinite(min) ? toISODate(new Date(min)) : null;
  })();
  const endPreview = (() => {
    const ends = tasks.map(t => t.end_planned).filter((v): v is string => !!v);
    if (ends.length === 0) return null;
    const max = Math.max(...ends.map(s => Date.parse(s)));
    return Number.isFinite(max) ? toISODate(new Date(max)) : null;
  })();

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
              <BreadcrumbLink href="/dashboard/projects">Projects</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{data.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-slate-900 truncate">{data.name}</h1>
            <p className="text-sm text-slate-500 truncate">{data.client_name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Status: {data.status}</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Owner: {data.division_owner?.name ?? '-'}</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Value: {currency(data.value_amount)}</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">Start: {data.start_planned ?? '-'}</span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600">End: {data.end_planned ?? '-'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/dashboard/projects/${data.id}/milestones/create`}
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
            >
              <Plus className="h-4 w-4" />
              Add Milestone
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-[0_12px_24px_rgba(15,23,42,0.08)] transition hover:border-[#00674F] hover:text-[#00674F]"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[200px] rounded-xl border border-slate-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.14)]">
                <DropdownMenuItem onSelect={() => (location.href = `/dashboard/projects/${data.id}/edit`)}>Edit Project</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => (location.href = `/dashboard/tasks/create?project_id=${data.id}`)}>Add Task</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => (location.href = `/dashboard/projects/${data.id}/gantt`)}>View Gantt</DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!canBaseline}
                  onSelect={() => setBaselineModalOpen(true)}
                >
                  {canBaseline ? 'Create Baseline' : 'Create Baseline (unavailable)'}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => history.back()}>Back</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Detail rows: 2 columns on desktop, 1 on mobile */}
        <div className="mt-5 grid gap-3 grid-cols-1 md:grid-cols-2">
          <Row label="Scope" value={data.scope ?? '-'} />
          <Row label="Objective" value={data.objective ?? '-'} />
          <Row label="Created At" value={data.created_at ?? '-'} />
          <Row label="Updated At" value={data.updated_at ?? '-'} />
        </div>
        <div className="mt-6">
          <div className="inline-flex rounded-xl border bg-white p-1 text-sm shadow-sm">
            {[
              { key: "overview", label: "Overview" },
              { key: "evm", label: "EVM" },
              { key: "milestones", label: "Milestones" },
              { key: "baselines", label: "Baselines" },
              { key: "tasks", label: "Tasks" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key as any)}
                className={`px-3 py-1.5 rounded-lg transition ${activeTab === (t.key as any) ? 'bg-neutral-100 text-slate-900' : 'text-slate-600 hover:bg-neutral-50'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <section>
          <div className="rounded-[24px] border border-transparent bg-white/95 shadow-[0_18px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 p-4">
            <div className="text-sm text-slate-600">Select a tab above to view EVM, Milestones, Baselines, or Tasks.</div>
          </div>
        </section>
      )}

      {activeTab === 'evm' && (
        <section>
          <div className="rounded-[24px] border border-transparent bg-white/95 shadow-[0_18px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 p-4">
            <EvmWidget projectId={data.id} reloadKey={evmReloadKey} />
          </div>
        </section>
      )}

      {activeTab === 'milestones' && (
      <section>
        <div className="rounded-[24px] border border-transparent bg-white/95 shadow-[0_18px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-700">Project Milestones</h3>
            <a href={`/dashboard/projects/${data.id}/milestones`} className="text-sm px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-neutral-50">View All</a>
          </div>
          <div className="overflow-x-auto">
            {milestonesLoading ? (
            <div className="p-3 text-sm text-neutral-500">Loading milestones...</div>
          ) : milestonesError ? (
            <div className="p-3 text-sm text-red-600">{milestonesError}</div>
          ) : milestones.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">No milestones</div>
          ) : (
            <table className="min-w-full text-sm table-fixed">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b w-[50%]">Name</th>
                  <th className="text-left font-medium px-3 py-2 border-b w-[20%]">Status</th>
                  <th className="text-left font-medium px-3 py-2 border-b w-[30%]">Due Planned</th>
                </tr>
              </thead>
              <tbody>
                {(milestones.slice(0, 5)).map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 border-t align-top truncate"><span className="block truncate" title={m.name}>{m.name}</span></td>
                    <td className="px-3 py-2 border-t align-top whitespace-nowrap">{m.status}</td>
                    <td className="px-3 py-2 border-t align-top whitespace-nowrap">{m.due_planned ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
        </div>
      </section>
      )}

      {activeTab === 'baselines' && (
      <section>
        <div className="rounded-[24px] border border-transparent bg-white/95 shadow-[0_18px_36px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-700">Project Baselines</h3>
            <div className="flex items-center gap-2">
              <a href={`/dashboard/projects/${data.id}/baselines`} className="text-sm px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-neutral-50">View All</a>
              <button
                className="text-sm px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setBaselineModalOpen(true)}
                disabled={!canBaseline}
                title={canBaseline ? 'Create baseline' : 'Requires: ≥1 milestone, ≥1 task with start & end planned'}
              >Create</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {baselinesLoading ? (
              <div className="p-3 text-sm text-neutral-500">Loading baselines...</div>
            ) : baselinesError ? (
              <div className="p-3 text-sm text-red-600">{baselinesError}</div>
            ) : baselines.length === 0 ? (
              <div className="p-3 text-sm text-neutral-500">No baselines</div>
            ) : (
              <table className="min-w-full text-sm table-fixed">
                <thead className="bg-neutral-50 text-neutral-700">
                  <tr>
                    <th className="text-left font-medium px-3 py-2 border-b w-[26%]">Baseline</th>
                    <th className="text-left font-medium px-3 py-2 border-b w-[18%]">Taken At</th>
                    <th className="text-left font-medium px-3 py-2 border-b w-[18%]">Start (Base)</th>
                    <th className="text-left font-medium px-3 py-2 border-b w-[18%]">End (Base)</th>
                    <th className="text-left font-medium px-3 py-2 border-b w-[20%]">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {baselines.map((b) => (
                    <tr key={b.id} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 border-t align-top truncate"><span className="block truncate" title={b.baseline_name}>{b.baseline_name}</span></td>
                      <td className="px-3 py-2 border-t align-top whitespace-nowrap">{b.taken_at ?? '-'}</td>
                      <td className="px-3 py-2 border-t align-top whitespace-nowrap">{(b as any).start_planned_base ?? '-'}</td>
                      <td className="px-3 py-2 border-t align-top whitespace-nowrap">{(b as any).end_planned_base ?? '-'}</td>
                      <td className="px-3 py-2 border-t align-top truncate"><span className="block truncate" title={b.note ?? ''}>{b.note ?? '-'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
      )}

      {baselineModalOpen && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl md:max-w-5xl p-6">
            <h4 className="text-base font-semibold mb-2">Create Project Baseline</h4>
            {baselineFormErr && <div className="text-sm text-red-600 mb-2">{baselineFormErr}</div>}
              <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBaselineSaving(true);
                setBaselineFormErr(null);
                try {
                  // Laravel API seems to require taken_at. Provide current timestamp if not provided by UI.
                  const formatDateTime = (d: Date) => {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    const mm = pad(d.getMonth() + 1);
                    const dd = pad(d.getDate());
                    const hh = pad(d.getHours());
                    const mi = pad(d.getMinutes());
                    const ss = pad(d.getSeconds());
                    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
                  };
                  // Compute baseline window from tasks: earliest start_planned and latest end_planned
                  const toISODate = (d: Date) => {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                  };
                  let startBase: string | null = null;
                  let endBase: string | null = null;
                  if (Array.isArray(tasks) && tasks.length > 0) {
                    const starts = tasks
                      .map((t) => t.start_planned)
                      .filter((v): v is string => !!v);
                    const ends = tasks
                      .map((t) => t.end_planned)
                      .filter((v): v is string => !!v);
                    if (starts.length > 0) {
                      const minMs = Math.min(...starts.map((s) => Date.parse(s)));
                      if (Number.isFinite(minMs)) startBase = toISODate(new Date(minMs));
                    }
                    if (ends.length > 0) {
                      const maxMs = Math.max(...ends.map((s) => Date.parse(s)));
                      if (Number.isFinite(maxMs)) endBase = toISODate(new Date(maxMs));
                    }
                  }
                  if (!baselineForm.baseline_name || baselineForm.baseline_name.trim().length === 0) {
                    setBaselineFormErr('Baseline name is required');
                    setBaselineSaving(false);
                    return;
                  }
                  if (!startBase || !endBase) {
                    setBaselineFormErr('Tidak bisa membuat baseline: butuh minimal 1 task dengan Start Planned dan 1 task dengan End Planned.');
                    setBaselineSaving(false);
                    return;
                  }
                  const takenAtNow = formatDateTime(new Date());
                  await apiRequest('POST', '/api/project-baselines', {
                    project_id: id,
                    baseline_name: baselineForm.baseline_name.trim(),
                    note: baselineForm.note?.trim() || null,
                    taken_at: takenAtNow,
                    // Provide baseline window so backend can persist or validate
                    start_planned_base: startBase,
                    end_planned_base: endBase,
                    // Fallback keys for backends that expect generic names
                    start_planned: startBase,
                    end_planned: endBase,
                  } as any);
                  setBaselineModalOpen(false);
                  setBaselineForm({ baseline_name: '', note: '' });
                  // Refresh baselines after creation
                  try {
                    const res = await apiRequest<ProjectBaseline[] | { data: ProjectBaseline[] }>('GET', `/api/project-baselines?project_id=${encodeURIComponent(String(id))}`);
                    const arr = Array.isArray(res) ? res : ((res as any)?.data ?? []);
                    arr.sort((a: any, b: any) => {
                      const ta = a.taken_at ? Date.parse(a.taken_at) : 0;
                      const tb = b.taken_at ? Date.parse(b.taken_at) : 0;
                      if (tb !== ta) return tb - ta;
                      return (b.id ?? 0) - (a.id ?? 0);
                    });
                    // Ensure newly created baseline reflects computed window in UI
                    if (arr.length > 0) {
                      const first = arr[0] as any;
                      first.start_planned_base = startBase ?? first.start_planned_base ?? first.start_planned ?? null;
                      first.end_planned_base = endBase ?? first.end_planned_base ?? first.end_planned ?? null;
                    }
                    setBaselines(arr as ProjectBaseline[]);
                  } catch {}
                } catch (e: any) {
                  const errors = e?.response?.data?.errors;
                  if (errors && typeof errors === 'object') {
                    const firstKey = Object.keys(errors)[0];
                    const val = errors[firstKey];
                    setBaselineFormErr(Array.isArray(val) ? val.join(', ') : String(val ?? 'Invalid'));
                  } else if (e?.response?.status === 404) {
                    setBaselineFormErr('Project not found or unauthorized');
                  } else if (e?.response?.status === 401 || e?.response?.status === 403) {
                    setBaselineFormErr('Not authorized to create baseline');
                  } else {
                    setBaselineFormErr(e?.message ?? 'Failed to create baseline');
                  }
                } finally {
                  setBaselineSaving(false);
                }
              }}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              <div className="min-w-0">
                <label className="block text-sm mb-1">Baseline Name</label>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={baselineForm.baseline_name}
                  onChange={(e) => setBaselineForm((s) => ({ ...s, baseline_name: e.target.value }))}
                  required
                />
              </div>
              <div className="min-w-0">
                <label className="block text-sm mb-1">Note (optional)</label>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={baselineForm.note}
                  onChange={(e) => setBaselineForm((s) => ({ ...s, note: e.target.value }))}
                />
              </div>
              <div className="text-xs text-neutral-600 md:col-span-2">
                Calculated Start (Base): <span className="font-medium text-neutral-900">{startPreview ?? '-'}</span> •
                {' '}End (Base): <span className="font-medium text-neutral-900">{endPreview ?? '-'}</span>
              </div>
              <div className="flex justify-end gap-2 pt-2 md:col-span-2">
                <button type="button" onClick={() => setBaselineModalOpen(false)} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
                <button type="submit" disabled={baselineSaving} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{baselineSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'tasks' && (
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Milestone Tasks</h3>
          <a href={`/dashboard/projects/${data.id}/milestones`} className="text-sm px-2 py-1 border rounded-md hover:bg-neutral-50">View All</a>
        </div>

        {tasksLoading ? (
          <div className="p-3 text-sm text-neutral-500 border rounded-lg">Loading tasks...</div>
        ) : tasksError ? (
          <div className="p-3 text-sm text-red-600 border rounded-lg">{tasksError}</div>
        ) : (() => {
          // Build map milestone_id -> tasks[] (only tasks that belong to a milestone)
          const map: Record<number, Task[]> = {};
          for (const t of tasks) {
            const mid = (t.milestone?.id ?? t.milestone_id) as number | undefined;
            if (!mid) continue;
            if (!map[mid]) map[mid] = [];
            map[mid].push(t);
          }

          // Sort milestones (already sorted in state), take top 5 and only those with tasks
          const topWithTasks = milestones.filter(m => map[m.id] && map[m.id].length > 0).slice(0, 5);

          if (topWithTasks.length === 0) {
            return <div className="p-3 text-sm text-neutral-500 border rounded-lg">No tasks from milestones</div>;
          }

          return (
            <div className="space-y-4">
              {topWithTasks.map((m) => {
                const list = map[m.id] || [];
                const topTasks = list; // show all tasks for the milestone (was limited to 3)
                return (
                  <div key={m.id} className="border rounded-lg">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-neutral-50">
                      <div className="text-sm font-medium">
                        <a className="hover:underline" href={`/dashboard/milestones/${m.id}`}>{m.name}</a>
                      </div>
                      <div className="text-xs text-neutral-600">{m.status} • Due: {m.due_planned ?? '-'}</div>
                    </div>
                    <table className="min-w-full text-sm">
                      <thead className="text-neutral-700">
                        <tr>
                          <th className="text-left font-medium px-3 py-2 border-b">Title</th>
                          <th className="text-left font-medium px-3 py-2 border-b">Status</th>
                          <th className="text-left font-medium px-3 py-2 border-b">Percent</th>
                          <th className="text-left font-medium px-3 py-2 border-b">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topTasks.map((t) => {
                          const open = !!openTaskIds[(t.id as number)];
                          const toggle = async () => {
                            setOpenTaskIds(s => ({ ...s, [t.id]: !s[t.id as number] }));
                            const willOpen = !open;
                            if (willOpen) {
                              const tid = Number(t.id);
                              if (Number.isFinite(tid) && taskTotalHours[tid] === undefined && !taskTotalHoursLoading[tid]) {
                                setTaskTotalHoursLoading(s => ({ ...s, [tid]: true }));
                                setTaskTotalHoursError(s => ({ ...s, [tid]: null }));
                                try {
                                  const total = await totalHoursByTask(tid);
                                  const value = typeof total === 'number' ? total : Number((total as any)?.total ?? 0);
                                  setTaskTotalHours(s => ({ ...s, [tid]: Number.isFinite(value) ? value : 0 }));
                                } catch (e: any) {
                                  setTaskTotalHoursError(s => ({ ...s, [tid]: e?.message ?? 'Gagal memuat total jam' }));
                                } finally {
                                  setTaskTotalHoursLoading(s => ({ ...s, [tid]: false }));
                                }
                              }
                            }
                          };
                          // Build assignees list from possible shapes
                          const raw: any = t as any;
                          const fromAssignments = Array.isArray(raw?.assignments) ? raw.assignments.map((a: any) => ({
                            name: a?.user?.name ?? a?.user_name ?? a?.user?.full_name ?? a?.user?.email ?? String(a?.user_id ?? ''),
                            role: a?.role_on_task ?? 'Member',
                          })) : [];
                          const fromUsers = Array.isArray(raw?.users) ? raw.users.map((u: any) => ({
                            name: u?.name ?? u?.full_name ?? u?.email ?? String(u?.id ?? ''),
                            role: u?.pivot?.role_on_task ?? 'Member',
                          })) : [];
                          const assignees = (fromAssignments.length ? fromAssignments : fromUsers);
                          return (
                            <>
                              <tr key={`row-${t.id}`} className="hover:bg-neutral-50">
                                <td className="px-3 py-2 border-t">{t.title}</td>
                                <td className="px-3 py-2 border-t">{t.status}</td>
                                <td className="px-3 py-2 border-t">{(t.percent_complete ?? 0)}%</td>
                                <td className="px-3 py-2 border-t space-x-2">
                                  <button type="button" onClick={toggle} className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm">
                                    {open ? 'Hide' : 'Details'}
                                  </button>
                                  <button
                                    type="button"
                                    className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={taskBaselineLoading[t.id] || !t.start_planned || !t.end_planned}
                                    onClick={async () => {
                                      if (!t.start_planned || !t.end_planned) {
                                        alert('Task ini belum memiliki Start/End Planned.');
                                        return;
                                      }
                                      setTaskBaselineLoading(s => ({ ...s, [t.id]: true }));
                                      try {
                                        // Cari project baseline terbaru (sudah ada di state baselines dan disortir desc saat load)
                                        let baselineId: number | undefined = undefined;
                                        if (Array.isArray(baselines) && baselines.length > 0) {
                                          baselineId = Number(baselines[0].id);
                                        }
                                        // Dedup: jika sudah ada task baseline untuk baseline ini, abaikan
                                        if (baselineId) {
                                          try {
                                            const existing = await listTaskBaselines(t.id);
                                            const found = (existing || []).some((b: any) => Number(b?.baseline_id) === baselineId);
                                            if (found) {
                                              alert('Task baseline untuk baseline project terbaru sudah ada.');
                                              setTaskBaselineLoading(s => ({ ...s, [t.id]: false }));
                                              return;
                                            }
                                          } catch {}
                                        }
                                        const startBase: string = t.start_planned as any;
                                        const endBase: string = t.end_planned as any;
                                        const duration = (Number.isFinite(Date.parse(endBase)) && Number.isFinite(Date.parse(startBase)))
                                          ? (Math.max(0, Math.round((Date.parse(endBase) - Date.parse(startBase)) / (24*60*60*1000))) + 1)
                                          : null;
                                        const hoursPerDay = 8;
                                        const plannedHours = (duration != null) ? (duration * hoursPerDay) : null;
                                        await createTaskBaseline(t.id, {
                                          start_planned_base: startBase,
                                          end_planned_base: endBase,
                                          duration_planned_base: duration as any,
                                          weight: 1 as any,
                                          planned_effort_hours: plannedHours as any,
                                          planned_hours: plannedHours as any,
                                          effort_hours: plannedHours as any,
                                          planned_effort: plannedHours as any,
                                          effort_planned: plannedHours as any,
                                          baseline_id: baselineId as any,
                                        } as any);
                                        alert('Task baseline berhasil dibuat.');
                                      } catch (e: any) {
                                        const msg = e?.response?.data?.message || e?.message || 'Gagal membuat task baseline';
                                        alert(msg);
                                      } finally {
                                        setTaskBaselineLoading(s => ({ ...s, [t.id]: false }));
                                      }
                                    }}
                                  >Create Baseline</button>
                                  <a className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm" href={`/dashboard/tasks/${t.id}/edit`}>Edit</a>
                                </td>
                              </tr>
                              {open && (
                                <tr key={`detail-${t.id}`} className="bg-neutral-50/60">
                                  <td colSpan={4} className="px-3 py-3 border-t">
                                    <div className="grid gap-1 text-xs text-neutral-700">
                                      <div><span className="text-neutral-500">Description:</span> <span className="text-neutral-900">{(raw.description ?? '-') || '-'}</span></div>
                                      <div className="flex flex-wrap gap-4">
                                        <span><span className="text-neutral-500">Priority:</span> {raw.priority ?? 'Medium'}</span>
                                        <span><span className="text-neutral-500">Start:</span> {raw.start_planned ?? '-'}</span>
                                        <span><span className="text-neutral-500">End:</span> {raw.end_planned ?? '-'}</span>
                                      </div>
                                      <div>
                                        <span className="text-neutral-500">Assignees:</span>{' '}
                                        {assignees.length === 0 ? (
                                          <span className="text-neutral-900">No assignees</span>
                                        ) : (
                                          <span className="text-neutral-900">{
                                            assignees
                                              .map((a) => {
                                                const role = (a.role ?? '').trim();
                                                const showRole = role && role.toLowerCase() !== 'member';
                                                return showRole ? `${a.name} (${role})` : a.name;
                                              })
                                              .join(', ')
                                          }</span>
                                        )}
                                      </div>
                                      <div className="mt-3 pt-3 border-t">
                                        <div className="text-neutral-900 font-medium mb-2">Update & Log</div>
                                        <div className="flex flex-wrap items-start gap-4">
                                          <TaskProgressEditor
                                            taskId={t.id}
                                            initialPercent={t.percent_complete ?? 0}
                                            onSaved={() => setEvmReloadKey(k => k + 1)}
                                          />
                                          {currentUserId > 0 ? (
                                            <TimeEntryForm
                                              taskId={t.id}
                                              userId={currentUserId}
                                              onSaved={async () => {
                                                setEvmReloadKey(k => k + 1);
                                                const tid = Number(t.id);
                                                if (Number.isFinite(tid)) {
                                                  setTaskTotalHoursLoading(s => ({ ...s, [tid]: true }));
                                                  try {
                                                    const total = await totalHoursByTask(tid);
                                                    const value = typeof total === 'number' ? total : Number((total as any)?.total ?? 0);
                                                    setTaskTotalHours(s => ({ ...s, [tid]: Number.isFinite(value) ? value : 0 }));
                                                  } catch (e: any) {
                                                    setTaskTotalHoursError(s => ({ ...s, [tid]: e?.message ?? 'Gagal memuat total jam' }));
                                                  } finally {
                                                    setTaskTotalHoursLoading(s => ({ ...s, [tid]: false }));
                                                  }
                                                }
                                              }}
                                            />
                                          ) : (
                                            <div className="text-[11px] text-neutral-500">Login required to log time.</div>
                                          )}
                                          <div className="text-xs text-neutral-700 mt-1">
                                            {taskTotalHoursLoading[Number(t.id)] ? (
                                              <span className="inline-block px-2 py-0.5 rounded border bg-neutral-50">Loading hours…</span>
                                            ) : taskTotalHoursError[Number(t.id)] ? (
                                              <span className="inline-block px-2 py-0.5 rounded border bg-red-50 text-red-700">{taskTotalHoursError[Number(t.id)]}</span>
                                            ) : (
                                              <span className="inline-block px-2 py-0.5 rounded border bg-neutral-50">Total Hours: <b>{taskTotalHours[Number(t.id)] ?? 0}</b></span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-inner flex items-center">
        <span className="truncate w-full whitespace-nowrap">{value}</span>
      </div>
    </div>
  );
}

// old Row variant removed to avoid duplicate declaration; unified above
