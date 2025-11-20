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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

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
    return () => {
      mounted = false;
    };
  }, [id]);

  if (!id) return <div className="text-neutral-500">Invalid project id</div>;

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="px-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/projects">Projects</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Loading Gantt…</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-32 rounded-md" />
              <Skeleton className="h-7 w-40 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-6 w-64 rounded-md mb-4" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="w-full space-y-4 -mx-2 md:-mx-4">
      <div className="flex items-center justify-between px-2 md:px-4">
        <div className="flex items-center gap-3">
          <a
            href={`/dashboard/projects/${id}`}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back to Project
          </a>
          <h2 className="text-xl md:text-2xl font-semibold text-foreground">Project Gantt</h2>
        </div>
      </div>
      <div className="px-2 md:px-4">
        <GanttChart tasks={tasks} milestones={milestones} baselines={baselines} />
      </div>
    </div>
  );
}

