"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import { useSearchParams } from "next/navigation";
import { listByProject as listMilestonesByProject } from "@/lib/api/milestones";
import type { Milestone } from "@/types/milestone";
import { fetchProjectsList } from "@/lib/lookups";

type FormState = {
  project_id: number | "";
  title: string;
  description: string;
  priority: string;
  status: string;
  start_planned: string;
  end_planned: string;
  percent_complete: number;
  assignments?: { user_id: number; role_on_task: string | null }[];
  dependencies?: { depends_on_task_id: number; type?: 'FS'|'SS'|'FF'|'SF'; lag_days?: number }[];
};

export default function CreateTaskPage() {
  const router = useRouter();
  const search = useSearchParams();
  const initialProjectId = search?.get('project_id');
  const [form, setForm] = useState<FormState>({
    project_id: initialProjectId ? Number(initialProjectId) : "",
    title: "",
    description: "",
    priority: "Medium",
    status: "To Do",
    start_planned: "",
    end_planned: "",
    percent_complete: 0,
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestoneId, setMilestoneId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [depOptions, setDepOptions] = useState<Array<{ id: number; title: string }>>([]);
  const [depsLoading, setDepsLoading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    if (name === 'percent_complete') {
      setForm((s) => ({ ...s, percent_complete: Number(value) }));
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
      };
      if (form.assignments && form.assignments.length > 0) {
        // Backend requires non-null role_on_task; default to 'Member' if null/empty
        payload.assignments = form.assignments.map(a => ({
          user_id: a.user_id,
          role_on_task: (a.role_on_task && a.role_on_task.trim()) ? a.role_on_task : 'Member',
        }));
      }
      if (typeof form.dependencies !== 'undefined') {
        // Send dependencies if user interacted; allow empty array to clear
        payload.dependencies = (form.dependencies || []).map((d: any) => ({
          depends_on_task_id: Number(d.depends_on_task_id),
          type: (d.type as any) || 'FS',
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
      router.push("/dashboard/tasks");
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message;
      setError(msg ? `Gagal membuat task (${status ?? 'error'}): ${msg}` : "Gagal membuat task");
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

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Create Task</h2>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Project</label>
          <select name="project_id" value={form.project_id} onChange={onChange} className="w-full border rounded-md px-3 py-2">
            <option value="">(Optional) Pilih project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Milestone (optional)</label>
          <select
            name="milestone_id"
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value ? Number(e.target.value) : "")}
            className="w-full border rounded-md px-3 py-2"
            disabled={!form.project_id}
          >
            <option value="">Unassigned</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          {!form.project_id && (
            <p className="text-xs text-neutral-500 mt-1">Pilih project terlebih dahulu untuk menampilkan milestones.</p>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input name="title" value={form.title} onChange={onChange} required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Description</label>
          <textarea name="description" value={form.description} onChange={onChange} className="w-full border rounded-md px-3 py-2" rows={4} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Priority</label>
            <select name="priority" value={form.priority} onChange={onChange} className="w-full border rounded-md px-3 py-2">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Status</label>
            <select name="status" value={form.status} onChange={onChange} className="w-full border rounded-md px-3 py-2">
              <option>To Do</option>
              <option>In Progress</option>
              <option>Done</option>
              <option>On Hold</option>
              <option>Cancelled</option>
            </select>
          </div>
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
                const checked = (form.assignments?.some(a => a.user_id === u.id)) ?? false;
                return (
                  <label key={u.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
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
                    <span>{u.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        {milestoneId ? (
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
                  const unique = Array.from(new Set(values));
                  setForm((s) => {
                    const prev = s.dependencies || [];
                    // Preserve existing type/lag for still-selected items; default new ones
                    const next = unique.map((id) => {
                      const found = prev.find(d => d.depends_on_task_id === id);
                      return found ? found : { depends_on_task_id: id, type: 'FS' as const, lag_days: 0 };
                    });
                    return { ...s, dependencies: next };
                  });
                }}
              >
                {depOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-neutral-500 mt-1">Default type FS, lag 0. Hold Ctrl/Cmd to select multiple.</p>
            {Array.isArray(form.dependencies) && form.dependencies.length > 0 && (
              <div className="mt-2 grid gap-2">
                {form.dependencies.map((d, idx) => {
                  const title = depOptions.find(o => o.id === d.depends_on_task_id)?.title ?? `#${d.depends_on_task_id}`;
                  return (
                    <div key={`${d.depends_on_task_id}-${idx}`} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="px-2 py-1 bg-neutral-100 rounded">{title}</span>
                      <select
                        className="border rounded px-2 py-1"
                        value={(d.type as any) || 'FS'}
                        onChange={(e) => {
                          const val = e.target.value as 'FS'|'SS'|'FF'|'SF';
                          setForm((s) => ({
                            ...s,
                            dependencies: (s.dependencies || []).map((x) => x.depends_on_task_id === d.depends_on_task_id ? { ...x, type: val } : x)
                          }));
                        }}
                      >
                        <option value="FS">FS</option>
                        <option value="SS">SS</option>
                        <option value="FF">FF</option>
                        <option value="SF">SF</option>
                      </select>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-neutral-600">Lag</label>
                        <input
                          type="number"
                          className="w-20 border rounded px-2 py-1"
                          value={Number(d.lag_days ?? 0)}
                          onChange={(e) => {
                            const val = Number(e.target.value || 0);
                            setForm((s) => ({
                              ...s,
                              dependencies: (s.dependencies || []).map((x) => x.depends_on_task_id === d.depends_on_task_id ? { ...x, lag_days: val } : x)
                            }));
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="ml-auto px-2 py-1 border rounded hover:bg-neutral-50"
                        onClick={() => {
                          setForm((s) => ({
                            ...s,
                            dependencies: (s.dependencies || []).filter((x) => x.depends_on_task_id !== d.depends_on_task_id)
                          }));
                        }}
                      >Remove</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Start Planned</label>
            <input type="date" name="start_planned" value={form.start_planned} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">End Planned</label>
            <input type="date" name="end_planned" value={form.end_planned} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Percent Complete</label>
          <input type="number" min={0} max={100} name="percent_complete" value={form.percent_complete} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={submitting} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{submitting ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
