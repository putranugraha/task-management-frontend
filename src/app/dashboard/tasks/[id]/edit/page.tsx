"use client";

import { useEffect, useState } from "react";
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

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => s ? ({
      ...s,
      [name]: name === 'percent_complete' ? Number(value) : (name === 'project_id' ? (value ? Number(value) : "") : value),
    }) : s);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
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
      await apiRequest("PUT", `/api/tasks/${form.id}`, payload);
      router.push("/dashboard/tasks");
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
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Edit Task</h2>
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
        <div>
          <label className="block text-sm mb-1">Title</label>
          <input name="title" value={form.title} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Description</label>
          <textarea name="description" value={form.description ?? ""} onChange={onChange} className="w-full border rounded-md px-3 py-2" rows={4} />
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
        <div>
          <label className="block text-sm mb-1">Percent Complete</label>
          <input type="number" min={0} max={100} name="percent_complete" value={form.percent_complete} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={saving} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
