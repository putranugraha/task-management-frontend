"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import { fetchProjectsList } from "@/lib/lookups";

type MilestoneDetail = {
  id: number;
  project_id: number | "";
  name: string;
  due_planned: string | null;
  due_actual: string | null;
  status: string;
};

export default function EditMilestonePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [form, setForm] = useState<MilestoneDetail | null>(null);
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
        const data = await apiRequest<any>("GET", `/api/milestones/${id}`);
        const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;
        const m = Array.isArray(payload) ? payload[0] : payload;
        if (mounted && m) {
          setForm({
            id: m.id,
            project_id: (m.project?.id as number) ?? (m.project_id ?? ""),
            name: m.name,
            due_planned: m.due_planned ?? "",
            due_actual: m.due_actual ?? "",
            status: m.status ?? 'Planned',
          });
        }
      } catch (e: any) {
        setError(e?.message ?? "Gagal memuat data milestone");
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

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => s ? ({
      ...s,
      [name]: name === 'project_id' ? (value ? Number(value) : "") : value,
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
        name: form.name,
        due_planned: form.due_planned || null,
        due_actual: form.due_actual || null,
        status: form.status,
      };
      await apiRequest("PUT", `/api/milestones/${form.id}`, payload);
      router.push("/dashboard/milestones");
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan milestone");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!form) return <div>Not found</div>;

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Edit Milestone</h2>
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
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Due Planned</label>
            <input type="date" name="due_planned" value={form.due_planned ?? ''} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Due Actual</label>
            <input type="date" name="due_actual" value={form.due_actual ?? ''} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Status</label>
          <select name="status" value={form.status} onChange={onChange} className="w-full border rounded-md px-3 py-2">
            <option>Planned</option>
            <option>In Progress</option>
            <option>Done</option>
            <option>Delayed</option>
          </select>
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={saving} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

