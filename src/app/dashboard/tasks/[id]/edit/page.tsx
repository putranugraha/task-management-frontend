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

