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
      await apiRequest("POST", "/api/tasks", payload);
      router.push("/dashboard/tasks");
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat task");
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
