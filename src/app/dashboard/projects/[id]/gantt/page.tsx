"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";
import type { ProjectBaseline } from "@/types/project-baseline";
import { listByProject as listTasksByProject } from "@/lib/api/tasks";
import { listByProject as listMilestonesByProject } from "@/lib/api/milestones";
import { apiRequest } from "@/lib/api";
import GanttChart from "@/components/gantt/GanttChart";

export default function ProjectGanttPage() {
  const params = useParams();
  const id = Number(params?.id);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [baselines, setBaselines] = useState<ProjectBaseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [t, m] = await Promise.all([
          listTasksByProject(id).catch(() => []),
          listMilestonesByProject(id).catch(() => []),
        ]);
        const res = await apiRequest<ProjectBaseline[] | { data: ProjectBaseline[] }>(
          "GET",
          `/api/project-baselines?project_id=${encodeURIComponent(String(id))}`
        ).catch(() => ([] as any));
        const b = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        // stabilize task ordering for deterministic rendering
        const ts = (Array.isArray(t) ? t : []).slice().sort((a, b) => {
          const sa = a.status || "";
          const sb = b.status || "";
          if (sa !== sb) return sa.localeCompare(sb);
          const ca = a.created_at ? Date.parse(a.created_at) : 0;
          const cb = b.created_at ? Date.parse(b.created_at) : 0;
          if (ca !== cb) return ca - cb;
          return (a.id ?? 0) - (b.id ?? 0);
        });
        const ms = (Array.isArray(m) ? m : []).slice().sort((a, b) => {
          const da = a.due_planned ? Date.parse(a.due_planned) : Number.POSITIVE_INFINITY;
          const db = b.due_planned ? Date.parse(b.due_planned) : Number.POSITIVE_INFINITY;
          if (da !== db) return da - db;
          const ca = a.created_at ? Date.parse(a.created_at) : 0;
          const cb = b.created_at ? Date.parse(b.created_at) : 0;
          if (ca !== cb) return ca - cb;
          return (a.id ?? 0) - (b.id ?? 0);
        });
        if (mounted) {
          setTasks(ts);
          setMilestones(ms);
          setBaselines(b as ProjectBaseline[]);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [id]);

  if (!id) return <div className="text-neutral-500">Invalid project id</div>;
  if (loading) return <div>Loading Gantt…</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center gap-2">
        <a href={`/dashboard/projects/${id}`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Back</a>
        <h2 className="text-xl font-semibold">Project Gantt</h2>
      </div>
      <GanttChart tasks={tasks} milestones={milestones} baselines={baselines} />
    </div>
  );
}
