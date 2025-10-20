"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { listByProject } from "@/lib/api/milestones";
import { listByProject as listTasksByProject } from "@/lib/api/tasks";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";
import type { ProjectBaseline } from "@/types/project-baseline";

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
  const [openTaskIds, setOpenTaskIds] = useState<Record<number, boolean>>({});
  // Baselines state
  const [baselines, setBaselines] = useState<ProjectBaseline[]>([]);
  const [baselinesLoading, setBaselinesLoading] = useState(false);
  const [baselinesError, setBaselinesError] = useState<string | null>(null);
  const [baselineModalOpen, setBaselineModalOpen] = useState(false);
  const [baselineSaving, setBaselineSaving] = useState(false);
  const [baselineForm, setBaselineForm] = useState<{ baseline_name: string; note: string }>(() => ({ baseline_name: "", note: "" }));
  const [baselineFormErr, setBaselineFormErr] = useState<string | null>(null);

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

  // Fetch project baselines
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!id) return;
      setBaselinesLoading(true);
      setBaselinesError(null);
      try {
        const res = await apiRequest<ProjectBaseline[] | { data: ProjectBaseline[] }>("GET", `/api/project-baselines?project_id=${encodeURIComponent(String(id))}`);
        const arr = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        arr.sort((a: any, b: any) => {
          const ta = a.taken_at ? Date.parse(a.taken_at) : 0;
          const tb = b.taken_at ? Date.parse(b.taken_at) : 0;
          if (tb !== ta) return tb - ta;
          return (b.id ?? 0) - (a.id ?? 0);
        });
        if (mounted) setBaselines(arr as ProjectBaseline[]);
      } catch (e: any) {
        setBaselinesError(e?.message ?? 'Failed to load baselines');
      } finally {
        setBaselinesLoading(false);
      }
    }
    run();
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
        <a href={`/dashboard/tasks/create?project_id=${data.id}`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Add Task</a>
        <button
          type="button"
          className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setBaselineModalOpen(true)}
          disabled={!(milestones.length > 0 && tasks.length > 0)}
          title={milestones.length > 0 && tasks.length > 0 ? 'Create baseline' : 'Requires at least 1 milestone and 1 task'}
        >
          Create Baseline
        </button>
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
          <h3 className="text-sm font-medium">Project Baselines</h3>
          <button
            className="text-sm px-2 py-1 border rounded-md hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setBaselineModalOpen(true)}
            disabled={!(milestones.length > 0 && tasks.length > 0)}
            title={milestones.length > 0 && tasks.length > 0 ? 'Create baseline' : 'Requires at least 1 milestone and 1 task'}
          >Create</button>
        </div>
        <div className="border rounded-lg">
          {baselinesLoading ? (
            <div className="p-3 text-sm text-neutral-500">Loading baselines...</div>
          ) : baselinesError ? (
            <div className="p-3 text-sm text-red-600">{baselinesError}</div>
          ) : baselines.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">No baselines</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b">Baseline</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Taken At</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Start (Base)</th>
                  <th className="text-left font-medium px-3 py-2 border-b">End (Base)</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Note</th>
                </tr>
              </thead>
              <tbody>
                {baselines.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 border-t">{b.baseline_name}</td>
                    <td className="px-3 py-2 border-t">{b.taken_at ?? '-'}</td>
                    <td className="px-3 py-2 border-t">{(b as any).start_planned_base ?? '-'}</td>
                    <td className="px-3 py-2 border-t">{(b as any).end_planned_base ?? '-'}</td>
                    <td className="px-3 py-2 border-t">{b.note ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {baselineModalOpen && (
        <div className="fixed inset-0 bg-black/30 grid place-items-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4">
            <h4 className="text-base font-semibold mb-2">Create Project Baseline</h4>
            {baselineFormErr && <div className="text-sm text-red-600 mb-2">{baselineFormErr}</div>}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBaselineSaving(true);
                setBaselineFormErr(null);
                try {
                  // Laravel API seems to require taken_at. Provide current timestamp if not provided by UI.
                  const formatDateTime = (d: Date) => {
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    const mm = pad(d.getMonth() + 1);
                    const dd = pad(d.getDate());
                    const hh = pad(d.getHours());
                    const mi = pad(d.getMinutes());
                    const ss = pad(d.getSeconds());
                    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
                  };
                  if (!baselineForm.baseline_name || baselineForm.baseline_name.trim().length === 0) {
                    setBaselineFormErr('Baseline name is required');
                    setBaselineSaving(false);
                    return;
                  }
                  await apiRequest('POST', '/api/project-baselines', {
                    project_id: id,
                    baseline_name: baselineForm.baseline_name.trim(),
                    note: baselineForm.note?.trim() || null,
                    taken_at: formatDateTime(new Date()),
                  } as any);
                  setBaselineModalOpen(false);
                  setBaselineForm({ baseline_name: '', note: '' });
                  // Refresh baselines after creation
                  try {
                    const res = await apiRequest<ProjectBaseline[] | { data: ProjectBaseline[] }>('GET', `/api/project-baselines?project_id=${encodeURIComponent(String(id))}`);
                    const arr = Array.isArray(res) ? res : ((res as any)?.data ?? []);
                    arr.sort((a: any, b: any) => {
                      const ta = a.taken_at ? Date.parse(a.taken_at) : 0;
                      const tb = b.taken_at ? Date.parse(b.taken_at) : 0;
                      if (tb !== ta) return tb - ta;
                      return (b.id ?? 0) - (a.id ?? 0);
                    });
                    setBaselines(arr as ProjectBaseline[]);
                  } catch {}
                } catch (e: any) {
                  const errors = e?.response?.data?.errors;
                  if (errors && typeof errors === 'object') {
                    const firstKey = Object.keys(errors)[0];
                    const val = errors[firstKey];
                    setBaselineFormErr(Array.isArray(val) ? val.join(', ') : String(val ?? 'Invalid'));
                  } else if (e?.response?.status === 404) {
                    setBaselineFormErr('Project not found or unauthorized');
                  } else if (e?.response?.status === 401 || e?.response?.status === 403) {
                    setBaselineFormErr('Not authorized to create baseline');
                  } else {
                    setBaselineFormErr(e?.message ?? 'Failed to create baseline');
                  }
                } finally {
                  setBaselineSaving(false);
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-sm mb-1">Baseline Name</label>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={baselineForm.baseline_name}
                  onChange={(e) => setBaselineForm((s) => ({ ...s, baseline_name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Note (optional)</label>
                <input
                  className="w-full border rounded-md px-3 py-2"
                  value={baselineForm.note}
                  onChange={(e) => setBaselineForm((s) => ({ ...s, note: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setBaselineModalOpen(false)} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
                <button type="submit" disabled={baselineSaving} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{baselineSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                        {topTasks.map((t) => {
                          const open = !!openTaskIds[(t.id as number)];
                          const toggle = () => setOpenTaskIds(s => ({ ...s, [t.id]: !s[t.id as number] }));
                          // Build assignees list from possible shapes
                          const raw: any = t as any;
                          const fromAssignments = Array.isArray(raw?.assignments) ? raw.assignments.map((a: any) => ({
                            name: a?.user?.name ?? a?.user_name ?? a?.user?.full_name ?? a?.user?.email ?? String(a?.user_id ?? ''),
                            role: a?.role_on_task ?? 'Member',
                          })) : [];
                          const fromUsers = Array.isArray(raw?.users) ? raw.users.map((u: any) => ({
                            name: u?.name ?? u?.full_name ?? u?.email ?? String(u?.id ?? ''),
                            role: u?.pivot?.role_on_task ?? 'Member',
                          })) : [];
                          const assignees = (fromAssignments.length ? fromAssignments : fromUsers);
                          return (
                            <>
                              <tr key={`row-${t.id}`} className="hover:bg-neutral-50">
                                <td className="px-3 py-2 border-t">{t.title}</td>
                                <td className="px-3 py-2 border-t">{t.status}</td>
                                <td className="px-3 py-2 border-t">{(t.percent_complete ?? 0)}%</td>
                                <td className="px-3 py-2 border-t space-x-2">
                                  <button type="button" onClick={toggle} className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm">
                                    {open ? 'Hide' : 'Details'}
                                  </button>
                                  <a className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm" href={`/dashboard/tasks/${t.id}/edit`}>Edit</a>
                                </td>
                              </tr>
                              {open && (
                                <tr key={`detail-${t.id}`} className="bg-neutral-50/60">
                                  <td colSpan={4} className="px-3 py-3 border-t">
                                    <div className="grid gap-1 text-xs text-neutral-700">
                                      <div><span className="text-neutral-500">Description:</span> <span className="text-neutral-900">{(raw.description ?? '-') || '-'}</span></div>
                                      <div className="flex flex-wrap gap-4">
                                        <span><span className="text-neutral-500">Priority:</span> {raw.priority ?? 'Medium'}</span>
                                        <span><span className="text-neutral-500">Start:</span> {raw.start_planned ?? '-'}</span>
                                        <span><span className="text-neutral-500">End:</span> {raw.end_planned ?? '-'}</span>
                                      </div>
                                      <div>
                                        <span className="text-neutral-500">Assignees:</span>{' '}
                                        {assignees.length === 0 ? (
                                          <span className="text-neutral-900">No assignees</span>
                                        ) : (
                                          <span className="text-neutral-900">{
                                            assignees
                                              .map((a) => {
                                                const role = (a.role ?? '').trim();
                                                const showRole = role && role.toLowerCase() !== 'member';
                                                return showRole ? `${a.name} (${role})` : a.name;
                                              })
                                              .join(', ')
                                          }</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
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
