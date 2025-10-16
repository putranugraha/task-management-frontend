"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { listByProject } from "@/lib/api/milestones";
import { listByProject as listTasksByProject } from "@/lib/api/tasks";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";

type ProjectDetail = {
  id: number;
  name: string;
  client_name: string;
  value_amount: number | string;
  scope: string | null;
  objective: string | null;
  division_owner?: { id: number; name: string; email?: string } | null;
  start_planned: string | null;
  end_planned: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params?.id);

  const [data, setData] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestonesError, setMilestonesError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<any>("GET", `/api/projects/${id}`);
        const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
        const p = Array.isArray(payload) ? payload[0] : payload;
        const owner = p.division_owner || p.owner || p.project_owner || null;
        const ownerObj = owner ? { id: Number(owner.id ?? owner.user_id ?? 0), name: owner.name ?? owner.full_name ?? owner.email ?? 'Unknown', email: owner.email } : null;
        const detail: ProjectDetail = {
          id: Number(p.id),
          name: p.name,
          client_name: p.client_name ?? p.client ?? '-',
          value_amount: typeof p.value_amount === 'string' ? p.value_amount : Number(p.value_amount ?? 0),
          scope: p.scope ?? null,
          objective: p.objective ?? null,
          division_owner: ownerObj,
          start_planned: p.start_planned ?? null,
          end_planned: p.end_planned ?? null,
          status: p.status ?? 'Planned',
          created_at: p.created_at,
          updated_at: p.updated_at,
        };
        if (mounted) setData(detail);
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404) {
          setNotFound(true);
        } else {
          setError(e?.message ?? 'Gagal memuat project');
        }
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!id) return;
      setMilestonesLoading(true);
      setMilestonesError(null);
      try {
        const list = await listByProject(id);
        if (mounted) {
          const arr = Array.isArray(list) ? list : [];
          arr.sort((a, b) => {
            const da = a.due_planned ? Date.parse(a.due_planned) : Number.POSITIVE_INFINITY;
            const db = b.due_planned ? Date.parse(b.due_planned) : Number.POSITIVE_INFINITY;
            if (da !== db) return da - db;
            const ca = a.created_at ? Date.parse(a.created_at) : 0;
            const cb = b.created_at ? Date.parse(b.created_at) : 0;
            if (ca !== cb) return ca - cb;
            return (a.id ?? 0) - (b.id ?? 0);
          });
          setMilestones(arr);
        }
      } catch (e: any) {
        setMilestonesError(e?.message ?? 'Gagal memuat milestones');
      } finally {
        setMilestonesLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [id]);

  // Fetch project tasks once, then group by milestone at render time
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!id) return;
      setTasksLoading(true);
      setTasksError(null);
      try {
        const list = await listTasksByProject(id);
        if (mounted) {
          const arr = Array.isArray(list) ? list : [];
          // Stabilize order: by status, then created_at, then id
          arr.sort((a, b) => {
            const sa = a.status || '';
            const sb = b.status || '';
            if (sa !== sb) return sa.localeCompare(sb);
            const ca = a.created_at ? Date.parse(a.created_at) : 0;
            const cb = b.created_at ? Date.parse(b.created_at) : 0;
            if (ca !== cb) return ca - cb;
            return (a.id ?? 0) - (b.id ?? 0);
          });
          setTasks(arr);
        }
      } catch (e: any) {
        setTasksError(e?.message ?? 'Gagal memuat tasks proyek');
      } finally {
        setTasksLoading(false);
      }
    }
    run();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (notFound) return <div className="text-neutral-500">Project not found</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-neutral-500">No project data</div>;

  const currency = (v: number | string) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (Number.isFinite(n)) {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
      } catch {
        return `IDR ${Math.round(n).toLocaleString()}`;
      }
    }
    return String(v ?? '');
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-3">Project Detail</h2>
      <div className="grid gap-2 border rounded-lg p-4">
        <Row label="Project" value={data.name} />
        <Row label="Client" value={data.client_name} />
        <Row label="Value" value={currency(data.value_amount)} />
        <Row label="Status" value={data.status} />
        <Row label="Owner" value={data.division_owner?.name ?? '-'} />
        <Row label="Start Planned" value={data.start_planned ?? '-'} />
        <Row label="End Planned" value={data.end_planned ?? '-'} />
        <Row label="Scope" value={data.scope ?? '-'} />
        <Row label="Objective" value={data.objective ?? '-'} />
        <Row label="Created At" value={data.created_at ?? '-'} />
        <Row label="Updated At" value={data.updated_at ?? '-'} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`/dashboard/projects/${data.id}/edit`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Edit</a>
        <a href={`/dashboard/projects/${data.id}/milestones/create`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Add Milestone</a>
        <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Back</button>
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Project Milestones</h3>
          <a href={`/dashboard/projects/${data.id}/milestones`} className="text-sm px-2 py-1 border rounded-md hover:bg-neutral-50">View All</a>
        </div>
        <div className="border rounded-lg">
          {milestonesLoading ? (
            <div className="p-3 text-sm text-neutral-500">Loading milestones...</div>
          ) : milestonesError ? (
            <div className="p-3 text-sm text-red-600">{milestonesError}</div>
          ) : milestones.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">No milestones</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b">Name</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Status</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Due Planned</th>
                </tr>
              </thead>
              <tbody>
                {(milestones.slice(0, 5)).map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 border-t">{m.name}</td>
                    <td className="px-3 py-2 border-t">{m.status}</td>
                    <td className="px-3 py-2 border-t">{m.due_planned ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Milestone Tasks</h3>
          <a href={`/dashboard/projects/${data.id}/milestones`} className="text-sm px-2 py-1 border rounded-md hover:bg-neutral-50">View All</a>
        </div>

        {tasksLoading ? (
          <div className="p-3 text-sm text-neutral-500 border rounded-lg">Loading tasks...</div>
        ) : tasksError ? (
          <div className="p-3 text-sm text-red-600 border rounded-lg">{tasksError}</div>
        ) : (() => {
          // Build map milestone_id -> tasks[] (only tasks that belong to a milestone)
          const map: Record<number, Task[]> = {};
          for (const t of tasks) {
            const mid = (t.milestone?.id ?? t.milestone_id) as number | undefined;
            if (!mid) continue;
            if (!map[mid]) map[mid] = [];
            map[mid].push(t);
          }

          // Sort milestones (already sorted in state), take top 5 and only those with tasks
          const topWithTasks = milestones.filter(m => map[m.id] && map[m.id].length > 0).slice(0, 5);

          if (topWithTasks.length === 0) {
            return <div className="p-3 text-sm text-neutral-500 border rounded-lg">No tasks from milestones</div>;
          }

          return (
            <div className="space-y-4">
              {topWithTasks.map((m) => {
                const list = map[m.id] || [];
                const topTasks = list.slice(0, 3);
                return (
                  <div key={m.id} className="border rounded-lg">
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-neutral-50">
                      <div className="text-sm font-medium">
                        <a className="hover:underline" href={`/dashboard/milestones/${m.id}`}>{m.name}</a>
                      </div>
                      <div className="text-xs text-neutral-600">{m.status} • Due: {m.due_planned ?? '-'}</div>
                    </div>
                    <table className="min-w-full text-sm">
                      <thead className="text-neutral-700">
                        <tr>
                          <th className="text-left font-medium px-3 py-2 border-b">Title</th>
                          <th className="text-left font-medium px-3 py-2 border-b">Status</th>
                          <th className="text-left font-medium px-3 py-2 border-b">Percent</th>
                          <th className="text-left font-medium px-3 py-2 border-b">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topTasks.map((t) => (
                          <tr key={t.id} className="hover:bg-neutral-50">
                            <td className="px-3 py-2 border-t">{t.title}</td>
                            <td className="px-3 py-2 border-t">{t.status}</td>
                            <td className="px-3 py-2 border-t">{(t.percent_complete ?? 0)}%</td>
                            <td className="px-3 py-2 border-t">
                              <a className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm" href={`/dashboard/tasks/${t.id}/edit`}>Edit</a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <div className="text-neutral-500">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}
