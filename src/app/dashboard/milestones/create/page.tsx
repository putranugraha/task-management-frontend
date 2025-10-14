"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import { fetchProjectsList } from "@/lib/lookups";

type FormState = {
  project_id: number | "";
  name: string;
  due_planned: string;
  status: string;
  due_actual: string;
};

export default function CreateMilestonePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    project_id: "",
    name: "",
    due_planned: "",
    status: "Planned",
    due_actual: "",
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => ({ ...s, [name]: name === 'project_id' ? (value ? Number(value) : "") : value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        project_id: form.project_id || null,
        name: form.name,
        due_planned: form.due_planned || null,
        status: form.status,
        due_actual: form.due_actual || null,
      };
      await apiRequest("POST", "/api/milestones", payload);
      router.push("/dashboard/milestones");
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat milestone");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchProjectsList();
        setProjects(list);
      } catch {}
    })();
  }, []);

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Create Milestone</h2>
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
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={onChange} required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Due Planned</label>
            <input type="date" name="due_planned" value={form.due_planned} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Due Actual</label>
            <input type="date" name="due_actual" value={form.due_actual} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
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
          <button type="submit" disabled={submitting} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{submitting ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

