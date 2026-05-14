"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import { listByProject as listMilestonesByProject } from "@/lib/api/milestones";
import type { Milestone } from "@/types/milestone";
import { fetchProjectsList } from "@/lib/lookups";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";
import { useToast } from "@/components/ui/toast";
import IdrCurrencyInput from "@/components/ui/IdrCurrencyInput";
import TaskDependencyEditor from "@/components/tasks/TaskDependencyEditor";

type FormState = {
  project_id: number | "";
  title: string;
  description: string;
  priority: string;
  status: string;
  start_planned: string;
  end_planned: string;
  percent_complete: number;
  budget_cost: string;
  assignments?: { user_id: number; role_on_task: string | null }[];
  dependencies?: { depends_on_task_id: number; type?: 'FS'|'SS'|'FF'|'SF'; lag_days?: number }[];
};

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const STATUS_OPTIONS = ["To Do", "In Progress", "Done", "On Hold", "Cancelled"];

function CreateTaskPageContent() {
  const { loading: authLoading, allowed } = usePermissionGuard([
    "membuat tugas",
  ]);

  if (!authLoading && !allowed) {
    return <Forbidden />;
  }

  const router = useRouter();
  const search = useSearchParams();
  const initialProjectId = search?.get('project_id');
  const todayLocal = (() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();
  const [form, setForm] = useState<FormState>({
    project_id: initialProjectId ? Number(initialProjectId) : "",
    title: "",
    description: "",
    priority: "Medium",
    status: "To Do",
    start_planned: "",
    end_planned: "",
    percent_complete: 0,
    budget_cost: "",
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestoneId, setMilestoneId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [depOptions, setDepOptions] = useState<Array<{ id: number; title: string }>>([]);
  const [depsLoading, setDepsLoading] = useState(false);
  const { showToast } = useToast();

  const milestoneDueMax = useMemo(() => {
    if (!milestoneId) return undefined;
    const m = milestones.find((x) => Number(x.id) === Number(milestoneId));
    return (m?.due_planned as any) || undefined;
  }, [milestones, milestoneId]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    if (name === 'percent_complete') {
      setForm((s) => ({ ...s, percent_complete: Number(value) }));
    } else if (name === 'budget_cost') {
      setForm((s) => ({ ...s, budget_cost: value }));
    } else if (name === 'project_id') {
      const val = value ? Number(value) : "";
      setForm((s) => ({ ...s, project_id: val }));
      setMilestoneId("");
    } else {
      setForm((s) => ({ ...s, [name]: value }));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Validate planned dates (consistent with project task create flow)
      if (form.start_planned && form.end_planned) {
        const startTs = Date.parse(form.start_planned);
        const endTs = Date.parse(form.end_planned);
        if (Number.isFinite(startTs) && Number.isFinite(endTs) && startTs > endTs) {
          const msg = "Start Planned tidak boleh setelah End Planned";
          setError(msg);
          showToast({
            variant: "error",
            title: "Tanggal task tidak valid",
            description: msg,
          });
          setSubmitting(false);
          return;
        }
      }

      if (milestoneDueMax) {
        const due = String(milestoneDueMax);
        if (form.start_planned && form.start_planned > due) {
          const msg = `Start Planned tidak boleh setelah Due Planned milestone (${due}).`;
          setError(msg);
          showToast({
            variant: "error",
            title: "Tanggal task tidak valid",
            description: msg,
          });
          setSubmitting(false);
          return;
        }
        if (form.end_planned && form.end_planned > due) {
          const msg = `End Planned tidak boleh setelah Due Planned milestone (${due}).`;
          setError(msg);
          showToast({
            variant: "error",
            title: "Tanggal task tidak valid",
            description: msg,
          });
          setSubmitting(false);
          return;
        }
      }

      const payload: Record<string, any> = {
        project_id: form.project_id || null,
        milestone_id: milestoneId || null,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        status: form.status,
        start_planned: form.start_planned || null,
        end_planned: form.end_planned || null,
        percent_complete: Number(form.percent_complete ?? 0),
        budget_cost: form.budget_cost === "" ? 0 : Number(form.budget_cost ?? 0),
      };
      if (form.assignments && form.assignments.length > 0) {
        // Backend requires non-null role_on_task; default to 'Member' if null/empty
        payload.assignments = form.assignments.map(a => ({
          user_id: a.user_id,
          role_on_task: (a.role_on_task && a.role_on_task.trim()) ? a.role_on_task : 'Member',
        }));
      }
      if (typeof form.dependencies !== 'undefined') {
        payload.dependencies = (form.dependencies || []).map((d: any) => ({
          depends_on_task_id: Number(d.depends_on_task_id),
          type: d.type || 'FS',
          lag_days: Number(d.lag_days ?? 0) || 0,
        }));
      }
      // Primary endpoint
      try {
        await apiRequest("POST", "/api/tasks", payload);
      } catch (err: any) {
        // Fallbacks for backends that require nested routes
        const status = err?.response?.status;
        let lastErr = err;
        const fallbacks: Array<{ url: string; adjust?: (p: any) => any }> = [];
        if (milestoneId) {
          fallbacks.push({ url: `/api/milestones/${milestoneId}/tasks` });
        }
        if (form.project_id) {
          fallbacks.push({ url: `/api/projects/${form.project_id}/tasks` });
        }
        let created = false;
        for (const fb of fallbacks) {
          try {
            const body = fb.adjust ? fb.adjust(payload) : payload;
            await apiRequest("POST", fb.url, body);
            created = true;
            break;
          } catch (e2: any) {
            lastErr = e2;
          }
        }
        if (!created) {
          throw lastErr;
        }
      }
      setSuccessMessage("Task berhasil dibuat.");
      showToast({
        variant: "success",
        title: "Task dibuat",
        description: `Task "${form.title}" berhasil dibuat.`,
      });
      setTimeout(() => router.push("/dashboard/tasks"), 900);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message;
      const fullMsg = msg ? `Gagal membuat task (${status ?? "error"}): ${msg}` : "Gagal membuat task";
      setError(fullMsg);
      showToast({
        variant: "error",
        title: "Gagal membuat task",
        description: fullMsg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchProjectsList();
        setProjects(list);
        if (initialProjectId) {
          try {
            const ms = await listMilestonesByProject(initialProjectId);
            setMilestones(ms);
          } catch {}
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!form.project_id) { setMilestones([]); return; }
      try {
        const ms = await listMilestonesByProject(form.project_id as number);
        setMilestones(ms);
      } catch {
        setMilestones([]);
      }
    })();
  }, [form.project_id]);

  // Fetch users for assignment options
  useEffect(() => {
    (async () => {
      setUsersLoading(true);
      try {
        const tryPaths = [
          "/api/users/options?status=1",
          "/api/users/options?status=Aktif",
          "/api/users/options",
          "/api/users?status=1",
          "/api/users?status=Aktif",
          "/api/users",
        ];
        let mapped: Array<{ id: number; name: string }> = [];
        for (const path of tryPaths) {
          try {
            const rs = await apiRequest<any>("GET", path);
            let arr: any[] = [];
            if (Array.isArray(rs)) arr = rs;
            else if (Array.isArray(rs?.data)) arr = rs.data;
            else if (Array.isArray(rs?.data?.data)) arr = rs.data.data;
            else if (Array.isArray(rs?.items)) arr = rs.items;
            else if (Array.isArray(rs?.users)) arr = rs.users;
            mapped = (arr || []).map((u: any) => ({
              id: Number(u.id ?? u.user_id ?? u.value ?? u.key),
              name: u.name ?? u.full_name ?? u.username ?? u.email ?? String(u.id ?? u.user_id ?? '')
            })).filter((u:any)=> Number.isFinite(u.id));
            const seen = new Set<number>();
            mapped = mapped.filter((u)=> (seen.has(u.id) ? false : (seen.add(u.id), true)));
            if (mapped.length) break;
          } catch {}
        }
        setUsers(mapped);
      } catch {
        setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    })();
  }, []);

  // Load dependency candidate tasks after milestone is chosen
  useEffect(() => {
    (async () => {
      setDepOptions([]);
      if (!milestoneId) return;
      // Clear dependencies when milestone changes to avoid stale references
      setForm((s) => ({ ...s, dependencies: [] }));
      setDepsLoading(true);
      try {
        const list = await (await import('@/lib/api/tasks')).listByMilestone(milestoneId as number);
        const opts = (Array.isArray(list) ? list : []).map((t: any) => ({ id: Number(t.id), title: t.title ?? String(t.id) }));
        setDepOptions(opts);
      } catch {
        setDepOptions([]);
      } finally {
        setDepsLoading(false);
      }
    })();
  }, [milestoneId]);

  const handleCancel = () => {
    if (submitting) return;
    router.push("/dashboard/tasks");
  };

  const checklistItems = useMemo(() => {
    const hasDates = Boolean(form.start_planned && form.end_planned);
    let planCompleted = false;
    if (hasDates) {
      const startTs = Date.parse(form.start_planned);
      const endTs = Date.parse(form.end_planned);
      planCompleted =
        Number.isFinite(startTs) &&
        Number.isFinite(endTs) &&
        startTs <= endTs;
    }

    return [
      { key: "title", label: "Isi judul task", completed: Boolean(form.title.trim()) },
      { key: "plan", label: "Atur tanggal rencana", completed: planCompleted },
      { key: "progress", label: "Set progress 0-100", completed: form.percent_complete >= 0 && form.percent_complete <= 100 },
      { key: "project", label: "Opsional: pilih project/milestone", completed: Boolean(form.project_id || milestoneId) },
    ];
  }, [form.title, form.start_planned, form.end_planned, form.percent_complete, form.project_id, milestoneId]);

  const checklistProgress = useMemo(() => {
    const total = checklistItems.length;
    const done = checklistItems.filter((i) => i.completed).length;
    return Math.round((done / total) * 100);
  }, [checklistItems]);

  const selectedProject = useMemo(() => {
    if (!form.project_id) return null;
    return projects.find((p) => Number(p.id) === Number(form.project_id)) ?? null;
  }, [projects, form.project_id]);

  const selectedMilestone = useMemo(() => {
    if (!milestoneId) return null;
    return milestones.find((m) => Number(m.id) === Number(milestoneId)) ?? null;
  }, [milestones, milestoneId]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <button type="button" onClick={handleCancel} className="group inline-flex items-center gap-2 text-sm font-medium text-[#00674F] transition hover:text-[#008061]">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00674F]/10 text-[#00674F] transition group-hover:bg-[#008061]/20 group-hover:text-[#008061]">
              <ChevronLeft className="h-4 w-4" />
            </span>
            Back to Tasks
          </button>
          <h1 className="text-3xl font-semibold text-slate-900">Create Task</h1>
          <p className="max-w-xl text-sm text-slate-500">Lengkapi informasi task agar tim paham konteks, jadwal, dan keterkaitannya.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{error}</div>
      )}

      <div className="grid gap-8 min-w-0 w-full lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="min-w-0 flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-xl">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="w-full rounded-full bg-emerald-800/30">
                <div className="h-1 rounded-full bg-white/80 transition-all duration-500" style={{ width: `${checklistProgress}%` }} />
              </div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">Task Checklist</h2>
            </div>
            <ul className="space-y-3 text-sm leading-relaxed">
              {checklistItems.map((item) => (
                <li key={item.key} className={`flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2 transition-all duration-300 hover:translate-x-1 ${item.completed ? 'text-white opacity-100' : 'text-white/70 opacity-60'}`}>
                  <span className={`mt-0.5 inline-block h-5 w-5 rounded-full ${item.completed ? 'bg-white' : 'bg-white/40'}`} />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Tip</p>
            <p className="text-sm leading-relaxed">Isi judul yang jelas dan target waktu realistis agar tim mudah sinkron.</p>
          </div>
        </aside>

        <form onSubmit={onSubmit} className="flex h-full min-w-0 w-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Task Details</h2>
            <p className="text-xs text-neutral-400">Informasi dasar task.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-500">Project</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300">
                    <span className={selectedProject ? 'text-slate-700' : 'text-slate-400'}>
                      {selectedProject?.name ?? 'Pilih project (opsional)'}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[260px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
                  <DropdownMenuItem onSelect={() => setForm((s) => ({ ...s, project_id: "" }))} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700">
                    <span>Tanpa project</span>
                    {!form.project_id && <Check className="h-4 w-4 text-emerald-500" />}
                  </DropdownMenuItem>
                  {projects.map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={() => setForm((s) => ({ ...s, project_id: Number(p.id) }))} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700">
                      <span>{p.name}</span>
                      {Number(form.project_id) === Number(p.id) && <Check className="h-4 w-4 text-emerald-500" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-500">Milestone</label>
              {form.project_id ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300">
                      <span className={selectedMilestone ? 'text-slate-700' : 'text-slate-400'}>
                        {selectedMilestone?.name ?? 'Pilih milestone (opsional)'}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[260px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
                    <DropdownMenuItem onSelect={() => setMilestoneId("")} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700">
                      <span>Tanpa milestone</span>
                      {!milestoneId && <Check className="h-4 w-4 text-emerald-500" />}
                    </DropdownMenuItem>
                    {milestones.map((m) => (
                      <DropdownMenuItem key={m.id} onSelect={() => setMilestoneId(Number(m.id))} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700">
                        <span>{m.name}</span>
                        {Number(milestoneId) === Number(m.id) && <Check className="h-4 w-4 text-emerald-500" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="title" className="text-sm font-semibold text-slate-500">Title</label>
              <input id="title" name="title" value={form.title} onChange={onChange} required className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" placeholder="Implement login page" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-500">Priority</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  >
                    <span className={form.priority ? "text-slate-700" : "text-slate-400"}>
                      {form.priority || "Pilih priority"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="min-w-[220px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onSelect={() =>
                        setForm((s) => ({
                          ...s,
                          priority: opt,
                        }))
                      }
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                    >
                      <span>{opt}</span>
                      {form.priority === opt && <Check className="h-4 w-4 text-emerald-500" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="space-y-2">
              <IdrCurrencyInput
                id="budget_cost"
                name="budget_cost"
                label="Budget Cost (IDR)"
                raw={form.budget_cost}
                onRawChange={(raw) => setForm((s) => ({ ...s, budget_cost: raw }))}
                placeholder="0"
                hint="Dipakai untuk PV/EV pada EVM cost-based (IDR)."
              />
            </div>
            {/* Status hidden on create; default "To Do" from form state is sent in payload */}
            {false && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Percent Complete</label>
                <input type="number" min={0} max={100} name="percent_complete" value={form.percent_complete} onChange={onChange} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" placeholder="0-100" />
              </div>
            )}
            <div className="space-y-2 md:col-span-2 lg:col-span-3">
              <label htmlFor="description" className="text-sm font-semibold text-slate-500">Description</label>
              <textarea id="description" name="description" value={form.description} onChange={onChange} rows={4} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" placeholder="Context, goals, acceptance criteria…" />
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Planning</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Start Planned</label>
                <input
                  type="date"
                  name="start_planned"
                  value={form.start_planned}
                  onChange={onChange}
                  min={todayLocal}
                  max={milestoneDueMax}
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">End Planned</label>
                <input
                  type="date"
                  name="end_planned"
                  value={form.end_planned}
                  onChange={onChange}
                  min={todayLocal}
                  max={milestoneDueMax}
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                />
              </div>
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Assignments</h2>
            {usersLoading ? (
              <Skeleton className="h-24 w-full rounded-xl bg-neutral-200/50" />
            ) : users.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">No users available.</div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-inner">
                <div className="grid max-h-56 grid-cols-1 gap-1 overflow-auto">
                  {users.map((u) => {
                    const checked = (form.assignments?.some(a => a.user_id === u.id)) ?? false;
                    return (
                      <label key={u.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50">
                        <span className="text-slate-700">{u.name}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-300"
                          checked={checked}
                          onChange={(e) => {
                            setForm((s) => {
                              const current = s.assignments ?? [];
                              if (e.target.checked) {
                                if (!current.some(a => a.user_id === u.id)) {
                                  return { ...s, assignments: [...current, { user_id: u.id, role_on_task: null }] };
                                }
                                return s;
                              } else {
                                return { ...s, assignments: current.filter(a => a.user_id !== u.id) };
                              }
                            });
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {milestoneId ? (
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Dependencies</h2>
              {depsLoading ? (
                <Skeleton className="h-24 w-full rounded-xl bg-neutral-200/50" />
              ) : (
                <TaskDependencyEditor
                  value={form.dependencies || []}
                  options={depOptions}
                  onChange={(dependencies) => setForm((s) => ({ ...s, dependencies }))}
                />
              )}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-400">Semua data dikirim melalui koneksi aman.</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleCancel} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300" disabled={submitting}>Cancel</button>
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Saving' : 'Create Task'}
              </button>
            </div>
          </div>
          {successMessage && (
            <p className="mt-3 text-sm font-medium text-emerald-600">✔ {successMessage}</p>
          )}
        </form>
      </div>
    </div>
  );
}

export default function CreateTaskPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-500">Loading…</div>}>
      <CreateTaskPageContent />
    </Suspense>
  );
}
