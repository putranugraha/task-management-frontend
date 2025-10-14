"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getById as getMilestoneById, updateStatus as setMilestoneStatus, complete as completeMilestone } from "@/lib/api/milestones";
import { listByMilestone, createForMilestone, updateStatus as setTaskStatus, updateProgress as setTaskProgress, complete as completeTask, remove as deleteTask } from "@/lib/api/tasks";
import type { Milestone } from "@/types/milestone";
import type { Task } from "@/types/task";
import DataTable from "@/app/dashboard/users/data-table";

type TaskRow = Pick<Task, 'id' | 'title' | 'status' | 'start_planned' | 'end_planned' | 'percent_complete'>;

export default function MilestoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [tLoading, setTLoading] = useState(false);
  const [tError, setTError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newTask, setNewTask] = useState({ title: "", status: "To Do", priority: "Medium", start_planned: "", end_planned: "", percent_complete: 0 });

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const m = await getMilestoneById(id);
        if (mounted) setMilestone(m);
      } catch (e: any) {
        const s = e?.response?.status;
        if (s === 404) setError('Milestone not found'); else setError(e?.message ?? 'Failed to load milestone');
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { mounted = false; };
  }, [id]);

  const fetchTasks = async () => {
    try {
      setTLoading(true);
      setTError(null);
      const list = await listByMilestone(id);
      // Sorting: due_planned asc (null last) -> created_at asc -> id asc
      const sorted = [...list].sort((a, b) => {
        const da = a.start_planned ? Date.parse(a.start_planned) : Number.POSITIVE_INFINITY;
        const db = b.start_planned ? Date.parse(b.start_planned) : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        const ca = a.created_at ? Date.parse(a.created_at) : 0;
        const cb = b.created_at ? Date.parse(b.created_at) : 0;
        if (ca !== cb) return ca - cb;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const mapped: TaskRow[] = sorted.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        start_planned: t.start_planned,
        end_planned: t.end_planned,
        percent_complete: Number(t.percent_complete ?? 0),
      }));
      setTasks(mapped);
    } catch (e: any) {
      setTError(e?.message ?? 'Failed to load tasks');
    } finally {
      setTLoading(false);
    }
  };

  useEffect(() => { if (id) fetchTasks(); }, [id]);

  const onCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalErr(null);
    try {
      if (!newTask.title) { setModalErr('Title is required'); setSaving(false); return; }
      if (!newTask.priority) { setModalErr('Priority is required'); setSaving(false); return; }
      if (newTask.percent_complete < 0 || newTask.percent_complete > 100) { setModalErr('Percent must be 0-100'); setSaving(false); return; }
      const projectIdForTask = (milestone as any)?.project_id ?? milestone?.project?.id;
      if (!projectIdForTask) {
        setModalErr('Project id is missing for this milestone');
        setSaving(false);
        return;
      }
      await createForMilestone(id, {
        title: newTask.title,
        status: newTask.status,
        priority: newTask.priority,
        start_planned: newTask.start_planned || null,
        end_planned: newTask.end_planned || null,
        percent_complete: Number(newTask.percent_complete ?? 0),
        project_id: Number(projectIdForTask),
      });
      setModalOpen(false);
      setNewTask({ title: "", status: "To Do", priority: "Medium", start_planned: "", end_planned: "", percent_complete: 0 });
      await fetchTasks();
    } catch (e: any) {
      const errors = e?.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        const firstKey = Object.keys(errors)[0];
        const val = errors[firstKey];
        setModalErr(Array.isArray(val) ? val.join(', ') : String(val ?? 'Invalid'));
      } else if (e?.response?.status === 404) {
        setModalErr('Milestone not found');
      } else if (e?.response?.status === 401 || e?.response?.status === 403) {
        setModalErr('Not authorized to perform this action');
      } else {
        setModalErr(e?.message ?? 'Failed to create task');
      }
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => {
    return [
      { key: 'title', header: 'Title' },
      { key: 'status', header: 'Status' },
      { key: 'start_planned', header: 'Start', render: (r: TaskRow) => r.start_planned ?? '-' },
      { key: 'end_planned', header: 'End', render: (r: TaskRow) => r.end_planned ?? '-' },
      { key: 'percent_complete', header: '%', render: (r: TaskRow) => `${r.percent_complete}%` },
      {
        key: 'actions',
        header: 'Actions',
        render: (row: TaskRow) => <TaskActions row={row} onChanged={fetchTasks} />,
      },
    ] as any;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!milestone) return <div className="text-neutral-500">No milestone</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-xl font-semibold">Milestone: {milestone.name}</h2>
          <div className="text-sm text-neutral-600">Status: {milestone.status} • Due: {milestone.due_planned ?? '-'}</div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50" onClick={async () => {
            try { const m = await getMilestoneById(milestone.id); setMilestone(m); } catch {} finally { await fetchTasks(); }
          }}>
            Refresh
          </button>
          <button className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50" onClick={async () => { await completeMilestone(milestone.id); router.refresh?.(); }}>
            Mark Completed
          </button>
        </div>
      </div>

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium">Tasks</h3>
          <button onClick={() => setModalOpen(true)} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Add Task</button>
        </div>
        <DataTable columns={columns} data={tasks} loading={tLoading} />
        {tError && <div className="mt-2 text-sm text-red-600">{tError}</div>}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <h4 className="text-base font-semibold mb-2">Create Task</h4>
            {modalErr && <div className="text-sm text-red-600 mb-2">{modalErr}</div>}
            <form onSubmit={onCreateTask} className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Title</label>
                <input className="w-full border rounded-md px-3 py-2" value={newTask.title} onChange={(e) => setNewTask(s => ({ ...s, title: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm mb-1">Status</label>
                  <select className="w-full border rounded-md px-3 py-2" value={newTask.status} onChange={(e) => setNewTask(s => ({ ...s, status: e.target.value }))}>
                    <option>To Do</option>
                    <option>In Progress</option>
                    <option>Done</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Priority</label>
                  <select className="w-full border rounded-md px-3 py-2" value={newTask.priority} onChange={(e) => setNewTask(s => ({ ...s, priority: e.target.value }))}>
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Percent</label>
                  <input type="number" min={0} max={100} className="w-full border rounded-md px-3 py-2" value={newTask.percent_complete} onChange={(e) => setNewTask(s => ({ ...s, percent_complete: Number(e.target.value || 0) }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Start Planned</label>
                  <input type="date" className="w-full border rounded-md px-3 py-2" value={newTask.start_planned} onChange={(e) => setNewTask(s => ({ ...s, start_planned: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm mb-1">End Planned</label>
                  <input type="date" className="w-full border rounded-md px-3 py-2" value={newTask.end_planned} onChange={(e) => setNewTask(s => ({ ...s, end_planned: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskActions({ row, onChanged }: { row: TaskRow; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(row.status);
  const [percent, setPercent] = useState(row.percent_complete);

  const doUpdateStatus = async () => {
    try { setSaving(true); await setTaskStatus(row.id, status); onChanged(); } catch (e: any) { alert(e?.message ?? 'Failed'); } finally { setSaving(false); }
  };
  const doUpdateProgress = async () => {
    try { setSaving(true); await setTaskProgress(row.id, percent); onChanged(); } catch (e: any) { alert(e?.message ?? 'Failed'); } finally { setSaving(false); }
  };
  const doComplete = async () => {
    const ok = confirm(`Mark task "${row.title}" as completed?`); if (!ok) return;
    try { setSaving(true); await completeTask(row.id); onChanged(); } catch (e: any) { alert(e?.message ?? 'Failed'); } finally { setSaving(false); }
  };
  const doDelete = async () => {
    const ok = confirm(`Delete task "${row.title}"?`); if (!ok) return;
    try { setSaving(true); await deleteTask(row.id); onChanged(); } catch (e: any) { alert(e?.message ?? 'Failed'); } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm" href={`/dashboard/tasks/${row.id}/edit`}>Edit</a>
      <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50 text-sm" onClick={doDelete}>Delete</button>
      <button className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm" onClick={doComplete} disabled={saving}>Complete</button>
      <div className="inline-flex items-center gap-2 text-sm">
        <select className="border rounded-md px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option>To Do</option>
          <option>In Progress</option>
          <option>Done</option>
        </select>
        <button className="px-2 py-1 rounded-md border hover:bg-neutral-50" onClick={doUpdateStatus} disabled={saving}>Update Status</button>
      </div>
      <div className="inline-flex items-center gap-2 text-sm">
        <input type="number" min={0} max={100} className="w-20 border rounded-md px-2 py-1" value={percent} onChange={(e) => setPercent(Number(e.target.value || 0))} />
        <button className="px-2 py-1 rounded-md border hover:bg-neutral-50" onClick={doUpdateProgress} disabled={saving}>Update %</button>
      </div>
    </div>
  );
}
