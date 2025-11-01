"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DataTable from "../../../users/data-table";
import { listByProject, remove, complete } from "@/lib/api/milestones";
import { listByProject as listTasksByProject } from "@/lib/api/tasks";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";
import { useMilestoneColumns, type MilestoneRow } from "./columns";

export default function ProjectMilestonesPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project Tasks state
  type TaskRow = {
    id: number;
    title: string;
    milestone?: { id: number; name: string } | null;
    priority: string;
    status: string;
    percent_complete: number;
  };
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [projectTasksFull, setProjectTasksFull] = useState<Task[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listByProject(projectId);
      // Sort raw milestones to keep order stable even when status changes
      const sorted: Milestone[] = [...list].sort((a, b) => {
        const da = a.due_planned ? Date.parse(a.due_planned) : Number.POSITIVE_INFINITY;
        const db = b.due_planned ? Date.parse(b.due_planned) : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        const ca = a.created_at ? Date.parse(a.created_at) : 0;
        const cb = b.created_at ? Date.parse(b.created_at) : 0;
        if (ca !== cb) return ca - cb;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const mapped: MilestoneRow[] = sorted.map((m: Milestone) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        due_planned: m.due_planned,
        due_actual: (m as any).due_actual ?? null,
        project: m.project ?? undefined,
      }));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load milestones");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTasks = async () => {
    if (!projectId) return;
    try {
      setTaskLoading(true);
      setTaskError(null);
      const list = await listTasksByProject(projectId);
      // Stabilize order: by status group then created_at/id
      const sorted: Task[] = [...list].sort((a, b) => {
        const sa = a.status || '';
        const sb = b.status || '';
        if (sa !== sb) return sa.localeCompare(sb);
        const ca = a.created_at ? Date.parse(a.created_at) : 0;
        const cb = b.created_at ? Date.parse(b.created_at) : 0;
        if (ca !== cb) return ca - cb;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const mapped: TaskRow[] = sorted.map((t: Task) => ({
        id: t.id,
        title: t.title,
        milestone: t.milestone ?? (t.milestone_id ? { id: t.milestone_id, name: '-' } : null),
        priority: t.priority,
        status: t.status,
        percent_complete: t.percent_complete ?? 0,
      }));
      setTaskRows(mapped);
      setProjectTasksFull(sorted);
    } catch (e: any) {
      setTaskError(e?.message ?? "Failed to load project tasks");
    } finally {
      setTaskLoading(false);
    }
  };

  useEffect(() => { if (projectId) { fetchList(); fetchProjectTasks(); } }, [projectId]);

  const handleDelete = async (row: MilestoneRow) => {
    const ok = confirm(`Hapus milestone ${row.name}?`);
    if (!ok) return;
    try {
      await remove(row.id);
      await fetchList();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menghapus milestone");
    }
  };

  const handleComplete = async (row: MilestoneRow) => {
    try {
      const tasks = projectTasksFull.filter(t => (t.milestone?.id ?? t.milestone_id) === row.id);
      let candidate: string | null = null;
      const actuals = tasks.map((t: any) => t.end_actual).filter(Boolean) as string[];
      if (actuals.length) {
        candidate = actuals.sort((a,b) => Date.parse(b)-Date.parse(a))[0];
      } else {
        const planned = tasks.map(t => t.end_planned).filter(Boolean) as string[];
        if (planned.length) candidate = planned.sort((a,b) => Date.parse(b)-Date.parse(a))[0];
      }
      const msg = `Mark milestone "${row.name}" as completed` + (candidate ? ` (actual: ${candidate})?` : '?');
      const ok = confirm(msg);
      if (!ok) return;
      await complete(row.id);
      await fetchList();
      await fetchProjectTasks();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to complete milestone');
    }
  };

  const columns = useMilestoneColumns({ onDelete: handleDelete, onChanged: fetchList, onComplete: handleComplete });

  return (
    <div className="w-full">
      <div className="mb-3">
        <Link href={`/dashboard/projects/${projectId}`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Back</Link>
      </div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Project Milestones</h2>
        <Link href={`/dashboard/projects/${projectId}/milestones/create`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Create Milestone</Link>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      <DataTable columns={columns as any} data={rows} loading={loading} />

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-xl font-semibold">Project Tasks</h2>
        <Link href={`/dashboard/tasks/create?project_id=${projectId}`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Create Task</Link>
      </div>
      {taskError && (
        <div className="mb-3 text-sm text-red-600">{taskError}</div>
      )}
      <DataTable
        columns={[
          { key: 'title', header: 'Title' },
          { key: 'milestone', header: 'Milestone', render: (r: TaskRow) => r.milestone?.name ?? '-' },
          { key: 'priority', header: 'Priority' },
          { key: 'status', header: 'Status' },
          { key: 'percent_complete', header: '%', render: (r: TaskRow) => `${r.percent_complete ?? 0}%` },
          { key: 'actions', header: 'Actions', render: (r: TaskRow) => (
            <div className="flex gap-2 text-sm">
              <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/tasks/${r.id}/edit`}>Edit</a>
            </div>
          )},
        ] as any}
        data={taskRows}
        loading={taskLoading}
        emptyText="No tasks in this project"
      />
    </div>
  );
}
