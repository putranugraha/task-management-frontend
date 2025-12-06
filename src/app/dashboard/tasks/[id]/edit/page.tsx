"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import { fetchProjectsList } from "@/lib/lookups";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";
import { DetailMainCard } from "@/components/layout/DetailCards";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronsUpDown, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type TaskDetail = {
  id: number;
  project_id: number | "";
  title: string;
  description: string | null;
  priority: string;
  status: string;
  start_planned: string | null;
  end_planned: string | null;
  percent_complete: number;
  assignments?: { user_id: number; role_on_task: string | null }[];
  dependencies?: { depends_on_task_id: number; type?: 'FS'|'SS'|'FF'|'SF'; lag_days?: number }[];
};

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const STATUS_OPTIONS = ["To Do", "In Progress", "Done", "On Hold", "Cancelled"];

export default function EditTaskPage() {
  const { loading: authLoading, allowed } = usePermissionGuard([
    "mengelola tugas",
  ]);

  if (!authLoading && !allowed) {
    return <Forbidden />;
  }

  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [form, setForm] = useState<TaskDetail | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [depOptions, setDepOptions] = useState<Array<{ id: number; title: string; status?: string }>>([]);
  const [depsLoading, setDepsLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<any>("GET", `/api/tasks/${id}`);
        const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;
        const t = Array.isArray(payload) ? payload[0] : payload;
        if (mounted && t) {
          // Normalize existing assignments from various shapes
          const currentAssignments: { user_id: number; role_on_task: string | null }[] = [];
          if (Array.isArray(t?.assignments)) {
            for (const a of t.assignments) {
              const uid = Number(a?.user_id ?? a?.user?.id ?? a?.id);
              if (Number.isFinite(uid)) currentAssignments.push({ user_id: uid, role_on_task: a?.role_on_task ?? null });
            }
          } else if (Array.isArray(t?.users)) {
            for (const u of t.users) {
              const uid = Number(u?.id);
              if (Number.isFinite(uid)) currentAssignments.push({ user_id: uid, role_on_task: u?.pivot?.role_on_task ?? null });
            }
          }
          const deps: { depends_on_task_id: number; type?: 'FS'|'SS'|'FF'|'SF'; lag_days?: number }[] = [];
          if (Array.isArray(t?.dependencies)) {
            for (const d of t.dependencies) {
              const did = Number((d as any)?.depends_on?.id ?? (d as any)?.depends_on_task_id ?? (d as any)?.id);
              if (Number.isFinite(did) && did !== t.id) {
                deps.push({ depends_on_task_id: did, type: (d as any)?.type ?? 'FS', lag_days: Number((d as any)?.lag_days ?? 0) || 0 });
              }
            }
          }
          setForm({
            id: t.id,
            project_id: (t.project?.id as number) ?? (t.project_id ?? ""),
            title: t.title,
            description: t.description ?? "",
            priority: t.priority ?? 'Medium',
            status: t.status ?? 'To Do',
            start_planned: t.start_planned ?? "",
            end_planned: t.end_planned ?? "",
            percent_complete: Number(t.percent_complete ?? 0),
            assignments: currentAssignments.length ? currentAssignments : undefined,
            dependencies: deps,
          });
        }
      } catch (e: any) {
        const msg = e?.message ?? "Gagal memuat data task";
        setError(msg);
        showToast({
          variant: "error",
          title: "Gagal memuat task",
          description: msg,
        });
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchProjectsList();
        setProjects(list);
      } catch {}
    })();
  }, []);

  // Fetch users options for assignments checklist
  useEffect(() => {
    (async () => {
      setUsersLoading(true);
      try {
        const tryPaths = [
          '/api/users/options?status=1',
          '/api/users/options?status=Aktif',
          '/api/users/options',
          '/api/users?status=1',
          '/api/users?status=Aktif',
          '/api/users',
        ];
        let mapped: Array<{ id: number; name: string }> = [];
        for (const path of tryPaths) {
          try {
            const rs = await apiRequest<any>('GET', path);
            let arr: any[] = [];
            if (Array.isArray(rs)) arr = rs;
            else if (Array.isArray(rs?.data)) arr = rs.data;
            else if (Array.isArray(rs?.data?.data)) arr = rs.data.data;
            else if (Array.isArray(rs?.items)) arr = rs.items;
            else if (Array.isArray(rs?.users)) arr = rs.users;
            mapped = (arr || []).map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email ?? String(u.id) }));
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

  // Load dependency candidate tasks based on task's milestone if available, otherwise by project
  useEffect(() => {
    (async () => {
      const milestoneId = (form as any)?.milestone_id || (form as any)?.milestone?.id || null;
      const projectId = form?.project_id || null;
      if (!milestoneId && !projectId) { setDepOptions([]); return; }
      setDepsLoading(true);
      try {
        let list: any[] = [];
        if (milestoneId) {
          list = await (await import('@/lib/api/tasks')).listByMilestone(milestoneId as number);
        } else if (projectId) {
          list = await (await import('@/lib/api/tasks')).listByProject(projectId as number);
        }
        const opts = (Array.isArray(list) ? list : []).map((t: any) => ({ id: Number(t.id), title: t.title ?? String(t.id), status: t.status ?? 'To Do' }));
        // Exclude self
        const filtered = opts.filter(o => o.id !== (form?.id ?? 0));
        setDepOptions(filtered);
      } catch {
        setDepOptions([]);
      } finally {
        setDepsLoading(false);
      }
    })();
  }, [form?.project_id]);

  const applyFieldUpdate = (name: string, value: string | number) => {
    const val = value;
    setForm((s) => {
      if (!s) return s;
      // Coerce numeric percent and clamp 0..100
      if (name === 'percent_complete') {
        let p = Number(val);
        if (!Number.isFinite(p)) p = 0;
        if (p < 0) p = 0; if (p > 100) p = 100;
        // If percent hits 100, reflect intended status 'Done' in form state.
        const nextStatus = p === 100 ? 'Done' : s.status;
        return { ...s, percent_complete: p, status: nextStatus };
      }
      // If status changed to Done, force percent to 100 for consistency
      if (name === 'status') {
        const status = String(val);
        if ((status || '').toString() === 'Done') {
          const p = 100;
          return { ...s, status, percent_complete: p };
        }
        return { ...s, status } as any;
      }
      if (name === 'project_id') {
        return { ...s, project_id: val ? Number(val) : "" } as any;
      }
      return { ...s, [name]: val } as any;
    });
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    applyFieldUpdate(name, value);
  };

  const selectedProjectName = useMemo(() => {
    const pid = form?.project_id;
    if (!pid) return null;
    const p = projects.find((x) => Number(x.id) === Number(pid));
    return p?.name ?? null;
  }, [projects, form?.project_id]);

  const assigneeNames = useMemo(() => {
    if (!form?.assignments || form.assignments.length === 0) return [] as string[];
    const map = new Map<number, string>();
    users.forEach((u) => map.set(u.id, u.name));
    return form.assignments
      .map((a) => map.get(a.user_id))
      .filter((n): n is string => Boolean(n));
  }, [form?.assignments, users]);

  const checklistItems = useMemo(() => {
    const title = (form?.title ?? "").trim();
    const startPlanned = form?.start_planned ?? "";
    const endPlanned = form?.end_planned ?? "";
    const hasDates = Boolean(startPlanned && endPlanned);

    let planCompleted = false;
    if (hasDates) {
      const startTs = Date.parse(startPlanned);
      const endTs = Date.parse(endPlanned);
      planCompleted =
        Number.isFinite(startTs) &&
        Number.isFinite(endTs) &&
        startTs <= endTs;
    }

    return [
      { key: "title", label: "Isi judul task", completed: Boolean(title) },
      { key: "plan", label: "Atur tanggal rencana", completed: planCompleted },
      {
        key: "progress",
        label: "Set progress 0-100",
        completed:
          typeof form?.percent_complete === "number" &&
          form.percent_complete >= 0 &&
          form.percent_complete <= 100,
      },
      {
        key: "project",
        label: "Opsional: pilih project/milestone",
        completed: Boolean(form?.project_id),
      },
    ];
  }, [form?.title, form?.start_planned, form?.end_planned, form?.percent_complete, form?.project_id]);

  const checklistProgress = useMemo(() => {
    const total = checklistItems.length;
    if (!total) return 0;
    const done = checklistItems.filter((i) => i.completed).length;
    return Math.round((done / total) * 100);
  }, [checklistItems]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      // Dependency gating validation before submit
      const newStatus = String(form.status || 'To Do');
      const deps = form.dependencies || [];
      if (deps.length > 0) {
        const unmet: Array<{ title: string; type: string; reason: string }> = [];
        for (const d of deps) {
          const pred = depOptions.find(o => o.id === d.depends_on_task_id);
          const predStatus = (pred?.status || '').toString();
          const isDone = predStatus === 'Done';
          const isStarted = predStatus !== '' && predStatus !== 'To Do';
          const t = (d.type as any) || 'FS';
          if (newStatus === 'Done') {
            if ((t === 'FS' || t === 'FF') && !isDone) {
              unmet.push({ title: pred?.title || `#${d.depends_on_task_id}`, type: t, reason: 'harus selesai lebih dulu' });
            }
            if (t === 'SF' && !isStarted) {
              unmet.push({ title: pred?.title || `#${d.depends_on_task_id}`, type: t, reason: 'harus sudah mulai lebih dulu' });
            }
          }
          if (newStatus === 'In Progress') {
            if (t === 'FS' && !isDone) {
              unmet.push({ title: pred?.title || `#${d.depends_on_task_id}`, type: t, reason: 'harus selesai lebih dulu' });
            }
            if (t === 'SS' && !isStarted) {
              unmet.push({ title: pred?.title || `#${d.depends_on_task_id}`, type: t, reason: 'harus sudah mulai lebih dulu' });
            }
          }
        }
        if (unmet.length > 0) {
          const msg = 'Tidak bisa menyimpan status karena masih menunggu: ' + unmet.map(u => `${u.title} (${u.type}: ${u.reason})`).join(', ');
          setError(msg);
          setSaving(false);
          return;
        }
      }
      const payload: Record<string, any> = {
        project_id: form.project_id || null,
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        status: form.status,
        start_planned: form.start_planned || null,
        end_planned: form.end_planned || null,
        percent_complete: Number(form.percent_complete ?? 0),
      };
      if (form.assignments && form.assignments.length > 0) {
        // Backend requires non-null role_on_task; default to 'Member' if null/empty
        payload.assignments = form.assignments.map((a) => ({
          user_id: a.user_id,
          role_on_task: (a.role_on_task && a.role_on_task.trim()) ? a.role_on_task : 'Member',
        }));
      }
      if (typeof form.dependencies !== 'undefined') {
        payload.dependencies = (form.dependencies || []).map((d) => ({
          depends_on_task_id: Number(d.depends_on_task_id),
          type: (d.type as any) || 'FS',
          lag_days: Number(d.lag_days ?? 0) || 0,
        }));
      }
      await apiRequest("PUT", `/api/tasks/${form.id}`, payload);
      const pid = form.project_id && Number(form.project_id);
      showToast({
        variant: "success",
        title: "Perubahan disimpan",
        description: `Task "${form.title}" berhasil diperbarui.`,
      });
      if (Number.isFinite(pid)) {
        router.push(`/dashboard/projects/${pid}`);
      } else {
        router.push("/dashboard/tasks");
      }
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menyimpan task";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal menyimpan task",
        description: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  if (error) return <div className="text-red-600">{error}</div>;

  if (!form) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard/tasks")}
              className="group inline-flex items-center gap-2 text-sm font-medium text-[#00674F] transition hover:text-[#008061]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00674F]/10 text-[#00674F] transition group-hover:bg-[#008061]/20 group-hover:text-[#008061]" />
              Back to Tasks
            </button>
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-4 w-80 rounded-md" />
            </div>
          </div>
        </div>

        <DetailMainCard>
          <div className="grid items-stretch gap-8 min-w-0 w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <aside className="min-w-0 self-stretch flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="w-full rounded-full bg-emerald-800/30">
                    <div className="h-1 w-1/2 rounded-full bg-white/70 animate-pulse" />
                  </div>
                  <Skeleton className="h-5 w-40 rounded-md bg-white/20" />
                </div>
                <ul className="space-y-3 text-sm leading-relaxed">
                  {[1, 2, 3].map((i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2"
                    >
                      <div className="h-5 w-5 flex-none rounded-full bg-white/30 animate-pulse" />
                      <div className="h-3 w-3/4 rounded-md bg-white/30 animate-pulse" />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
                <Skeleton className="mb-2 h-3 w-16 rounded bg-white/20" />
                <Skeleton className="h-3 w-2/3 rounded bg-white/20" />
              </div>
            </aside>

            <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-3 w-64 rounded" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-24 w-full rounded-xl bg-neutral-200/60" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-32 rounded-full" />
              </div>
            </div>
          </div>
        </DetailMainCard>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-slate-900">Edit Task</h1>
          <p className="max-w-xl text-sm text-slate-500">Perbarui informasi task agar konsisten.</p>
        </div>
      </div>
      <div className="grid gap-8 min-w-0 w-full lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="min-w-0 flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="w-full rounded-full bg-emerald-800/30">
                <div className="h-1 rounded-full bg-white/80 transition-all duration-500" style={{ width: `${checklistProgress}%` }} />
              </div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">Task Overview</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white/20 text-lg font-bold">
                {getInitials(form.title, selectedProjectName ?? undefined)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xl font-semibold text-white">{form.title}</div>
                {selectedProjectName && (<div className="mt-1 text-sm text-white/80">{selectedProjectName}</div>)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">Status: {form.status}</span>
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">Progress {form.percent_complete ?? 0}%</span>
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">{form.priority}</span>
              {renderDueChip(form.end_planned)}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-white/90">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-white/60">Start Planned</div>
                <div className="font-semibold">{form.start_planned || '-'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-white/60">End Planned</div>
                <div className="font-semibold">{form.end_planned || '-'}</div>
              </div>
            </div>
            <div className="pt-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-50">Task Checklist</h3>
              <ul className="space-y-2 text-sm leading-relaxed">
                {checklistItems.map((item) => (
                  <li
                    key={item.key}
                    className={`flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2 transition-all duration-300 ${item.completed ? "text-white opacity-100" : "text-white/70 opacity-60"}`}
                  >
                    <span
                      className={`mt-0.5 inline-block h-5 w-5 rounded-full ${
                        item.completed ? "bg-white" : "bg-white/40"
                      }`}
                    />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            {assigneeNames.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/70">Assignees</div>
                <div className="flex flex-wrap items-center gap-2">
                  {assigneeNames.slice(0,5).map((n, i) => (
                    <span key={i} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-[10px] font-bold">{getInitials(n)}</span>
                      {n}
                    </span>
                  ))}
                  {assigneeNames.length > 5 && (
                    <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">+{assigneeNames.length - 5} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mt-6 rounded-xl border border-[#00674F]/30 bg-[#00674F]/20 p-4 text-white/80 backdrop-blur-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#E0F2EF]">Tip</p>
            <p className="text-sm leading-relaxed">Sesuaikan status dengan progress agar laporan akurat.</p>
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
                <button
                  type="button"
                  className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                >
                  <span className={selectedProjectName ? "text-slate-700" : "text-slate-400"}>
                    {selectedProjectName ?? "(Optional) Pilih project"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[260px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
              >
                <DropdownMenuItem
                  onSelect={() => applyFieldUpdate("project_id", "")}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                >
                  <span>Tanpa project</span>
                  {!form.project_id && <Check className="h-4 w-4 text-emerald-500" />}
                </DropdownMenuItem>
                {projects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => applyFieldUpdate("project_id", p.id)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                  >
                    <span>{p.name}</span>
                    {Number(form.project_id) === Number(p.id) && (
                      <Check className="h-4 w-4 text-emerald-500" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-semibold text-slate-500">Title</label>
            <input id="title" name="title" value={form.title} onChange={onChange} required className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" />
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
                    onSelect={() => applyFieldUpdate("priority", opt)}
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
            <label className="text-sm font-semibold text-slate-500">Status</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                >
                  <span className={form.status ? "text-slate-700" : "text-slate-400"}>
                    {form.status || "Pilih status"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[220px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt}
                    onSelect={() => applyFieldUpdate("status", opt)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                  >
                    <span>{opt}</span>
                    {form.status === opt && <Check className="h-4 w-4 text-emerald-500" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-500">Percent Complete</label>
            <input
              type="text"
              inputMode="numeric"
              name="percent_complete"
              value={String(form.percent_complete ?? "")}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, "");
                applyFieldUpdate("percent_complete", digitsOnly === "" ? 0 : Number(digitsOnly));
              }}
              className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
            />
          </div>
          <div className="space-y-2 md:col-span-2 lg:col-span-3">
            <label className="text-sm font-semibold text-slate-500">Description</label>
            <textarea name="description" value={form.description ?? ''} onChange={onChange} rows={4} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Dependencies (optional)</label>
          {depsLoading ? (
            <div className="text-xs text-neutral-500">Loading dependencies...</div>
          ) : depOptions.length === 0 ? (
            <div className="text-xs text-neutral-500">No dependency candidates</div>
          ) : (
            <select
              multiple
              className="w-full border rounded-md px-3 py-2 min-h-[120px]"
              value={(form.dependencies?.map(d => d.depends_on_task_id) ?? []) as any}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map(opt => Number(opt.value));
                const unique = Array.from(new Set(values)).filter(v => v !== form.id);
                const deps = unique.map(v => ({ depends_on_task_id: v, type: 'FS' as const, lag_days: 0 }));
                setForm((s) => s ? ({ ...s, dependencies: deps }) : s);
              }}
            >
              {depOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.title}</option>
              ))}
            </select>
          )}
          <p className="text-xs text-neutral-500 mt-1">Default type FS, lag 0. Hold Ctrl/Cmd to select multiple.</p>
        </div>
        <div>
          <label className="block text-sm mb-1">Assigned Users</label>
          {usersLoading ? (
            <div className="text-xs text-neutral-500">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="text-xs text-neutral-500">No users available.</div>
          ) : (
            <div className="border rounded-md px-3 py-2 max-h-56 overflow-auto space-y-1">
              {users.map((u) => {
                const checked = !!form.assignments?.some(a => a.user_id === u.id);
                return (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={(e) => {
                        setForm((s) => s ? (() => {
                          const current = s.assignments ?? [];
                          if (e.target.checked) {
                            if (!current.some(a => a.user_id === u.id)) {
                              return { ...s, assignments: [...current, { user_id: u.id, role_on_task: null }] };
                            }
                            return s;
                          } else {
                            return { ...s, assignments: current.filter(a => a.user_id !== u.id) };
                          }
                        })() : s);
                      }}
                    />
                    <span>{u.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Start Planned</label>
            <input type="date" name="start_planned" value={form.start_planned ?? ''} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">End Planned</label>
            <input type="date" name="end_planned" value={form.end_planned ?? ''} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="text-xs text-slate-400">Perubahan akan memperbarui task ini untuk semua anggota.</div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => router.push('/dashboard/tasks')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300" disabled={saving}>Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60">
              {saving && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />}
              {saving ? 'Saving' : 'Save Changes'}
            </button>
          </div>
        </div>
        </form>
      </div>
    </div>
  );
}

function getInitials(name?: string | null, fallback?: string | null) {
  const source = (name ?? fallback ?? '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? '').join('').toUpperCase();
}

function renderDueChip(endPlanned?: string | null) {
  if (!endPlanned) return null as any;
  const end = Date.parse(endPlanned);
  if (!Number.isFinite(end)) return null as any;
  const now = new Date();
  const days = Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000));
  let text = 'Due';
  if (days > 1) text = `Due in ${days} days`;
  else if (days === 1) text = 'Due tomorrow';
  else if (days === 0) text = 'Due today';
  else text = `Overdue ${Math.abs(days)}d`;
  return (<span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">{text}</span>);
}
