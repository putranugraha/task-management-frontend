"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createForProject, MILESTONE_STATUS_OPTIONS, type CreateMilestoneDto, listByProject as listMilestonesByProject } from "@/lib/api/milestones";
import { createForMilestone as createTaskForMilestone } from "@/lib/api/tasks";
import { apiRequest } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";

const TASK_STATUS_OPTIONS = ["To Do", "In Progress", "Done", "On Hold", "Cancelled"] as const;
const TASK_PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;
// Distinct accent colors to differentiate task cards
const TASK_CARD_COLORS = [
  '#059669', // emerald-600
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
] as const;

type FormState = {
  name: string;
  status: string;
  due_planned: string;
  due_actual: string;
};

type FieldErrors = Partial<Record<keyof CreateMilestoneDto, string>> & { [k: string]: string };

export default function CreateProjectMilestonePage() {
  const { loading: authLoading, allowed } = usePermissionGuard([
    "mengelola project",
  ]);

  if (!authLoading && !allowed) {
    return <Forbidden />;
  }

  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [form, setForm] = useState<FormState>({
    name: "",
    status: "Planned",
    due_planned: "",
    due_actual: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Users for task assignments
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Optional: create initial tasks together with milestone
  type TaskForm = {
    tempKey: number;
    title: string;
    status: string;
    priority: string;
    start_planned: string;
    end_planned: string;
    percent_complete: number;
    dependsOnKeys?: number[];
    assigneeIds?: number[];
  };
  const [taskForms, setTaskForms] = useState<TaskForm[]>([]);
  const nextKeyRef = useRef(1);
  const addEmptyTask = () => setTaskForms((s) => ([...s, {
    tempKey: nextKeyRef.current++,
    title: "",
    status: "To Do",
    priority: "Medium",
    start_planned: "",
    end_planned: "",
    percent_complete: 0,
    dependsOnKeys: [],
    assigneeIds: [],
  }]));
  const removeTask = (idx: number) => setTaskForms((s) => s.filter((_, i) => i !== idx));

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => ({ ...s, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: '' }));
  };

  // Load users for assignment options (robust across API shapes)
  useEffect(() => {
    (async () => {
      setUsersLoading(true);
      try {
        // Try project-scoped members first, then fall back to global users
        const pid = encodeURIComponent(String(projectId));
        const tryPaths = [
          `/api/projects/${pid}/users`,
          `/api/projects/${pid}/members`,
          `/api/projects/${pid}/team`,
          `/api/projects/${pid}/participants`,
          `/api/projects/${pid}/assignable-users`,
          '/api/users/options?status=1',
          '/api/users/options?status=Aktif',
          '/api/users/options',
          '/api/users?status=1',
          '/api/users?status=Aktif',
          '/api/users',
        ];
        let mapped: Array<{ id: number; name: string }>=[];
        for (const path of tryPaths) {
          try {
            const rs:any = await apiRequest('GET', path);
            let arr:any[]=[];
            if (Array.isArray(rs)) arr=rs; else if (Array.isArray(rs?.data)) arr=rs.data; else if (Array.isArray(rs?.data?.data)) arr=rs.data.data; else if (Array.isArray(rs?.items)) arr=rs.items; else if (Array.isArray(rs?.users)) arr=rs.users;
            // Tolerate various id/name shapes
            mapped = (arr||[]).map((u:any)=>({
              id: Number(u.id ?? u.user_id ?? u.value ?? u.key),
              name: u.name ?? u.full_name ?? u.username ?? u.email ?? String(u.id ?? u.user_id ?? '')
            })).filter((u:any)=> Number.isFinite(u.id));
            // Deduplicate by id
            const seen = new Set<number>();
            mapped = mapped.filter((u)=> (seen.has(u.id) ? false : (seen.add(u.id), true)));
            if (mapped.length) break;
          } catch {}
        }
        setUsers(mapped);
      } catch { setUsers([]); }
      finally { setUsersLoading(false); }
    })();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      // Validate basic fields
      // Basic client-side validation
      if (!form.name || form.name.length > 150) {
        setFieldErrors((e) => ({ ...e, name: 'Name is required and must be <= 150 chars' }));
        setSubmitting(false);
        return;
      }
      if (!MILESTONE_STATUS_OPTIONS.includes(form.status as any)) {
        setFieldErrors((e) => ({ ...e, status: 'Invalid status' }));
        setSubmitting(false);
        return;
      }
      // Validate each task row: title required, start <= end, percent 0..100
      for (let i = 0; i < taskForms.length; i++) {
        const t = taskForms[i];
        if (!t.title || t.title.trim().length === 0) {
          alert(`Task #${i + 1} requires a title.`);
          setSubmitting(false);
          return;
        }
        if (t.start_planned && t.end_planned) {
          const s = Date.parse(t.start_planned);
          const en = Date.parse(t.end_planned);
          if (Number.isFinite(s) && Number.isFinite(en) && s > en) {
            alert(`Task #${i + 1} has Start after End. Please fix the dates.`);
            setSubmitting(false);
            return;
          }
        }
        const pct = Number(t.percent_complete ?? 0);
        if (!(pct >= 0 && pct <= 100)) {
          alert(`Task #${i + 1} percent must be 0-100.`);
          setSubmitting(false);
          return;
        }
      }

      // Soft warning A: sequence vs existing milestones in this project
      let duePlanned = form.due_planned || '';
      const dueTs = duePlanned ? Date.parse(duePlanned) : NaN;
      if (projectId && duePlanned && Number.isFinite(dueTs)) {
        try {
          const existing = await listMilestonesByProject(projectId);
          const existDue = (existing || []).map((m: any) => m?.due_planned).filter(Boolean) as string[];
          if (existDue.length) {
            const latest = existDue.sort((a,b) => Date.parse(b) - Date.parse(a))[0];
            if (Date.parse(duePlanned) < Date.parse(latest)) {
              const adjustMsg = `Due Planned (${duePlanned}) lebih awal dari milestone lain (terakhir ${latest}).\n\nRekomendasi: sesuaikan Due Planned menjadi ${latest}.\n\nKlik OK untuk menyesuaikan, Cancel untuk pilihan lain.`;
              const okAdj = confirm(adjustMsg);
              if (okAdj) {
                duePlanned = latest;
              } else {
                const proceed = confirm(`Lanjutkan tanpa menyesuaikan Due Planned (tetap ${duePlanned})?\n\nKlik OK untuk lanjut simpan, Cancel untuk batalkan dan ubah data.`);
                if (!proceed) { setSubmitting(false); return; }
              }
            }
          }
        } catch {}
      }

      // Soft warning B: tasks exceeding milestone due_planned
      if (duePlanned && Number.isFinite(dueTs)) {
        // find max end_planned among provided tasks
        const endDates = taskForms
          .map(t => t.end_planned)
          .filter(Boolean) as string[];
        const maxEnd = endDates.length ? endDates.sort((a,b) => Date.parse(b)-Date.parse(a))[0] : '';
        if (maxEnd && Date.parse(maxEnd) > dueTs) {
          // First prompt: adjust due to max end
          const okAdjust = confirm(`Ada ${endDates.length} task dengan tanggal akhir melebihi Due Planned (${duePlanned}).\n\nRekomendasi: sesuaikan Due Planned menjadi ${maxEnd}.\n\nKlik OK untuk menyesuaikan Due Planned. Klik Cancel untuk pilihan lain.`);
          if (okAdjust) {
            duePlanned = maxEnd;
          } else {
            // Second prompt: continue anyway or cancel submit
            const proceed = confirm(`Lanjutkan tanpa menyesuaikan Due Planned (tetap ${duePlanned})?\n\nKlik OK untuk lanjut simpan, Cancel untuk batalkan dan ubah data.`);
            if (!proceed) {
              setSubmitting(false);
              return;
            }
          }
        }
      }

      const payload: CreateMilestoneDto = {
        name: form.name,
        status: form.status as any,
        due_planned: duePlanned || null,
        // due_actual tidak dikirim saat create; akan diisi otomatis ketika milestone di-mark Complete
      } as any;
      const created = await createForProject(projectId, payload);
      const createdUnwrapped = created && typeof created === 'object' && 'data' in (created as any) ? (created as any).data : created;
      const milestoneId = (createdUnwrapped as any)?.id;
      // Create tasks if provided and milestone was created successfully
      if (milestoneId && Array.isArray(taskForms) && taskForms.length > 0) {
        // Filter rows that at least have a title
        const rows = taskForms.filter(t => (t.title || '').trim().length > 0);
        const createdMap = new Map<number, number>(); // tempKey -> createdId
        const failures: Array<{ title: string; error: unknown }> = [];
        for (const t of rows) {
          try {
            const dto: any = {
              title: t.title,
              status: t.status || 'To Do',
              priority: t.priority || 'Medium',
              start_planned: t.start_planned || null,
              end_planned: t.end_planned || null,
              percent_complete: Number.isFinite(t.percent_complete) ? Number(t.percent_complete) : 0,
              project_id: Number(projectId) || undefined,
              milestone_id: Number(milestoneId) || undefined,
            };
            if (Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0) {
              dto.assignments = t.assigneeIds.map((id) => ({ user_id: id, role_on_task: 'Member' }));
            }
            // translate dependencies to created ids (only previous tasks allowed)
            const depIds = (t.dependsOnKeys || []).map(k => createdMap.get(k)).filter(Boolean) as number[];
            if (depIds.length) {
              dto.dependencies = depIds.map(id => ({ depends_on_task_id: id, type: 'FS', lag_days: 0 }));
            }
            let createdTask: any = null;
            try {
              createdTask = await createTaskForMilestone(milestoneId, dto);
            } catch (err: any) {
              // Fallbacks for diverse backends
              try {
                // Try flat /api/tasks with milestone_id and project_id
                const body1 = { ...dto, milestone_id: Number(milestoneId), project_id: Number(projectId) };
                createdTask = await apiRequest<any>('POST', '/api/tasks', body1);
              } catch (e2: any) {
                // Try nested project route
                const body2 = { ...dto, milestone_id: Number(milestoneId) };
                createdTask = await apiRequest<any>('POST', `/api/projects/${projectId}/tasks`, body2);
              }
            }
            const unwrapped = createdTask && typeof createdTask === 'object' && 'data' in createdTask ? (createdTask as any).data : createdTask;
            const newId = (unwrapped as any)?.id ?? (unwrapped as any)?.task_id ?? (unwrapped as any)?.task?.id;
            if (newId) createdMap.set(t.tempKey, Number(newId));
            else {
              failures.push({ title: t.title, error: createdTask });
            }
          } catch (e) {
            // Keep creating the rest; surface a generic notice
            console.warn('Failed to create a task for milestone', e);
            failures.push({ title: t.title, error: e });
          }
        }
        if (failures.length) {
          try {
            console.error('Some tasks failed to create:', failures);
            alert(`Warning: ${failures.length} task(s) gagal dibuat. Cek konsol untuk detail.`);
          } catch {}
        }
      }
      // Redirect back to Project Detail so the new milestone appears in the detail page section
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e: any) {
      // 422 validation mapping (Laravel)
      const errors = e?.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        const mapped: FieldErrors = {};
        Object.keys(errors).forEach((k) => {
          const val = errors[k];
          mapped[k] = Array.isArray(val) ? val.join(', ') : String(val ?? 'Invalid');
        });
        setFieldErrors(mapped);
      } else if (e?.response?.status === 404) {
        // Some backends use 404 for unauthorized project access (policy hides existence)
        setError('Project not found or you may not have permission');
      } else if (e?.response?.status === 401 || e?.response?.status === 403) {
        setError('Not authorized to perform this action');
      } else {
        setError(e?.message ?? 'Failed to create milestone');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 w-full min-w-0 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 w-full min-w-0">
        <div className="space-y-2">
          <a
            href={`/dashboard/projects/${projectId}`}
            className="group inline-flex items-center gap-2 text-sm font-medium text-[#00674F] transition hover:text-[#008061]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00674F]/10 text-[#00674F] transition group-hover:bg-[#008061]/20 group-hover:text-[#008061]">
              <ChevronLeft className="h-4 w-4" />
            </span>
            Back to Project
          </a>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Create Milestone</h1>
          <p className="max-w-xl text-sm text-slate-500">Tambahkan milestone baru untuk project ini. Pastikan tanggal dan status sesuai.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <div className="grid items-stretch gap-8 min-w-0 w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: tips/checklist */}
        <aside className="min-w-0 self-stretch flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">Milestone Tips</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-white/70" />Nama singkat dan jelas.</li>
              <li className="flex items-start gap-2"><span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-white/70" />Gunakan Due Planned sebagai target.</li>
              <li className="flex items-start gap-2"><span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-white/70" />Tasks opsional; bisa ditambahkan di detail project.</li>
            </ul>
          </div>
          <div className="text-xs/5 text-white/90">
            Project ID: <span className="font-semibold">{String(projectId)}</span>
          </div>
        </aside>

        {/* Right: form */}
        <form onSubmit={onSubmit} className="min-w-0 rounded-[24px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input name="name" value={form.name} onChange={onChange} required maxLength={150} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" placeholder="e.g. Phase 1 Delivery" />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>
            {/* Status hidden: default "Planned" used server-side */}
            <div>
              <label className="block text-sm mb-1">Due Planned</label>
              <input type="date" name="due_planned" value={form.due_planned} onChange={onChange} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" />
              {fieldErrors.due_planned && <p className="text-xs text-red-600 mt-1">{fieldErrors.due_planned}</p>}
            </div>
            <div>
              <label className="block text-sm mb-1">Due Actual</label>
              <input
                type="date"
                name="due_actual"
                value={form.due_actual}
                onChange={onChange}
                className="h-11 w-full rounded-xl border border-slate-200 bg-neutral-50 px-4 text-sm font-medium text-neutral-500 shadow-inner"
                disabled
                readOnly
                placeholder="Auto-filled when milestone is completed"
              />
              <p className="text-xs text-neutral-500 mt-1">Nilai ini akan terisi otomatis saat milestone ditandai Completed.</p>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Tasks (optional)</h3>
              <button type="button" onClick={addEmptyTask} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-neutral-50">Add Task</button>
            </div>
            {taskForms.length === 0 ? (
              <p className="text-xs text-neutral-500">Kamu bisa menambahkan task pertama milestone di sini. Ini opsional.</p>
            ) : (
              <div className="grid gap-3">
                {taskForms.map((t, idx) => (
                  <div key={t.tempKey} className="relative overflow-hidden rounded-2xl border border-slate-200 p-4 grid gap-3 bg-white/95 ring-1 ring-slate-100 shadow-[0_12px_24px_rgba(15,23,42,0.06),0_10px_24px_rgba(0,103,79,0.12)] transition hover:shadow-[0_16px_32px_rgba(15,23,42,0.08),0_14px_32px_rgba(0,103,79,0.18)]">
                    <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl" style={{ backgroundColor: TASK_CARD_COLORS[idx % TASK_CARD_COLORS.length] }} />
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-neutral-600">Task #{idx + 1}</div>
                      <button type="button" onClick={() => removeTask(idx)} className="text-xs px-2 py-1 border rounded hover:bg-neutral-50">Remove</button>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Title</label>
                      <input
                        value={t.title}
                        onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner"
                        placeholder="e.g. Implement Middleware RBAC"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm mb-1">Status</label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300">
                              <span className={t.status ? 'text-slate-700' : 'text-slate-400'}>{t.status || 'Pilih status'}</span>
                              <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[200px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
                            {TASK_STATUS_OPTIONS.map((sopt) => (
                              <DropdownMenuItem key={sopt} onSelect={() => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, status: sopt } : x))} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700">
                                <span>{sopt}</span>
                                {t.status === sopt && <Check className="h-4 w-4 text-emerald-500" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Priority</label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300">
                              <span className={t.priority ? 'text-slate-700' : 'text-slate-400'}>{t.priority || 'Pilih priority'}</span>
                              <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[200px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
                            {TASK_PRIORITY_OPTIONS.map((popt) => (
                              <DropdownMenuItem key={popt} onSelect={() => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, priority: popt } : x))} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700">
                                <span>{popt}</span>
                                {t.priority === popt && <Check className="h-4 w-4 text-emerald-500" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm mb-1">Start Planned</label>
                        <input type="date" value={t.start_planned}
                          onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, start_planned: e.target.value } : x))}
                          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">End Planned</label>
                        <input type="date" value={t.end_planned}
                          onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, end_planned: e.target.value } : x))}
                          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Percent Complete</label>
                      <input type="number" min={0} max={100} value={t.percent_complete}
                        onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, percent_complete: Number(e.target.value || 0) } : x))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Assignments</label>
                      {usersLoading ? (
                        <Skeleton className="h-20 w-full rounded-xl bg-neutral-200/50" />
                      ) : users.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">No users available.</div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-inner max-h-40 overflow-auto text-sm">
                          {users.map((u) => {
                            const checked = (t.assigneeIds || []).includes(u.id);
                            return (
                              <label key={u.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
                                <span className="text-slate-700">{u.name}</span>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-300"
                                  checked={checked}
                                  onChange={(e) => {
                                    setTaskForms((s) => s.map((x, i) => {
                                      if (i !== idx) return x;
                                      const set = new Set(x.assigneeIds || []);
                                      if (e.target.checked) set.add(u.id); else set.delete(u.id);
                                      return { ...x, assigneeIds: Array.from(set) };
                                    }));
                                  }}
                                />
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {idx > 0 && (
                      <div>
                        <label className="block text-sm mb-1">Depends On (previous tasks)</label>
                        <div className="border rounded-md p-2 max-h-40 overflow-auto text-sm">
                          {taskForms.slice(0, idx).map((cand, cidx) => {
                            const checked = (t.dependsOnKeys || []).includes(cand.tempKey);
                            const label = (cand.title && cand.title.trim()) ? cand.title : `Task #${cidx + 1}`;
                            return (
                              <label key={cand.tempKey} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={checked}
                                  onChange={(e) => {
                                    setTaskForms((s) => s.map((x, i) => {
                                      if (i !== idx) return x;
                                      const set = new Set(x.dependsOnKeys || []);
                                      if (e.target.checked) set.add(cand.tempKey); else set.delete(cand.tempKey);
                                      return { ...x, dependsOnKeys: Array.from(set) };
                                    }));
                                  }}
                                />
                                <span className="truncate">{label}</span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-xs text-neutral-500 mt-1">Default type FS, lag 0. Dukungan tipe/lag akan ditambahkan berikutnya.</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Saving' : 'Create Milestone'}
            </button>
            <a href={`/dashboard/projects/${projectId}`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
}
