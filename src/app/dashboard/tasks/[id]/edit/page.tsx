"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import { fetchProjectsList } from "@/lib/lookups";

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

export default function EditTaskPage() {
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
        setError(e?.message ?? "Gagal memuat data task");
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

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => {
      if (!s) return s;
      // Coerce numeric percent and clamp 0..100
      if (name === 'percent_complete') {
        let p = Number(value);
        if (!Number.isFinite(p)) p = 0;
        if (p < 0) p = 0; if (p > 100) p = 100;
        // If percent hits 100, reflect intended status 'Done' in form state.
        const nextStatus = p === 100 ? 'Done' : s.status;
        return { ...s, percent_complete: p, status: nextStatus };
      }
      // If status changed to Done, force percent to 100 for consistency
      if (name === 'status') {
        const status = value;
        if ((status || '').toString() === 'Done') {
          const p = 100;
          return { ...s, status, percent_complete: p };
        }
        return { ...s, status } as any;
      }
      if (name === 'project_id') {
        return { ...s, project_id: value ? Number(value) : "" } as any;
      }
      return { ...s, [name]: value } as any;
    });
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
      if (Number.isFinite(pid)) {
        router.push(`/dashboard/projects/${pid}`);
      } else {
        router.push("/dashboard/tasks");
      }
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan task");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!form) return <div>Not found</div>;

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
                <div className="h-1 rounded-full bg-white/80 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, Number(form.percent_complete ?? 0)))}%` }} />
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
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Tip</p>
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
            <select name="project_id" value={form.project_id} onChange={onChange} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300">
              <option value="">(Optional) Pilih project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-semibold text-slate-500">Title</label>
            <input id="title" name="title" value={form.title} onChange={onChange} required className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-500">Priority</label>
            <select name="priority" value={form.priority} onChange={onChange} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-500">Status</label>
            <select name="status" value={form.status} onChange={onChange} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300">
              <option>To Do</option>
              <option>In Progress</option>
              <option>Done</option>
              <option>On Hold</option>
              <option>Cancelled</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-500">Percent Complete</label>
            <input type="number" min={0} max={100} name="percent_complete" value={form.percent_complete} onChange={onChange} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" />
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
            <label className="block text-sm mb-1">Priority</label>
            <select name="priority" value={form.priority} onChange={onChange} className="w-full border rounded-md px-3 py-2">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Status</label>
            <select name="status" value={form.status} onChange={onChange} className="w-full border rounded-md px-3 py-2">
              <option>To Do</option>
              <option>In Progress</option>
              <option>Done</option>
            </select>
          </div>
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
