"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { create as createTaskBaseline, listByTask as listTaskBaselines } from "@/lib/api/task-baselines";

type Assignment = { user?: { id: number; name: string } | null; user_id?: number; role_on_task?: string | null; estimated_effort_hours?: number | null };
type Dependency = { type?: 'FS'|'SS'|'FF'|'SF'; lag_days?: number; depends_on?: { id: number; title: string } | null };

export default function TaskDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [baselineCreating, setBaselineCreating] = useState(false);
  const [baselineMsg, setBaselineMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchTask() {
      setLoading(true);
      setError(null);
      try {
        // Prefer including task_baselines when backend supports include
        const baseUrl = `/api/tasks/${id}`;
        const endpoints = [
          `${baseUrl}?include=task_baselines,baseline`,
          `${baseUrl}?include=task_baselines`,
          baseUrl,
        ];
        let payload: any = null;
        for (const ep of endpoints) {
          try {
            const res = await apiRequest<any>('GET', ep);
            const p = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
            payload = p;
            break;
          } catch (e: any) {
            if (e?.response?.status === 404) continue;
            throw e;
          }
        }
        // If backend didn’t include baselines, try listing by task id as a fallback
        if (payload && !Array.isArray(payload?.task_baselines)) {
          try {
            const list = await listTaskBaselines(id);
            payload.task_baselines = list;
          } catch {}
        }
        if (mounted) setData(payload);
      } catch (e: any) {
        setError(e?.message ?? 'Gagal memuat task');
      } finally {
        setLoading(false);
      }
    }
    fetchTask();
    return () => { mounted = false; };
  }, [id]);

  async function handleCreateBaseline() {
    setBaselineMsg(null);
    try {
      setBaselineCreating(true);
      // Prepare optional snapshot fields to satisfy stricter backends
      const startBase: string | null = (data?.start_planned ?? null) || null;
      const endBase: string | null = (data?.end_planned ?? null) || null;
      const durationBase: number | null = (startBase && endBase)
        ? (Math.max(0, Math.round((Date.parse(endBase) - Date.parse(startBase)) / (24 * 60 * 60 * 1000))) + 1)
        : null;
      const weight = 1.0;

      // Try to link to latest project baseline if backend requires baseline_id
      let baselineId: number | undefined = undefined;
      const projectId = (data?.project?.id ?? data?.project_id) as number | undefined;
      if (projectId) {
        try {
          const res = await apiRequest<any[] | { data: any[] }>('GET', `/api/project-baselines?project_id=${encodeURIComponent(String(projectId))}`);
          const list = Array.isArray(res) ? res : ((res as any)?.data ?? []);
          // Sort newest taken_at first as in project page
          list.sort((a: any, b: any) => {
            const ta = a.taken_at ? Date.parse(a.taken_at) : 0;
            const tb = b.taken_at ? Date.parse(b.taken_at) : 0;
            if (tb !== ta) return tb - ta;
            return (b.id ?? 0) - (a.id ?? 0);
          });
          if (list.length > 0) baselineId = Number(list[0].id);
        } catch {}
      }

      await createTaskBaseline(id, {
        start_planned_base: startBase,
        end_planned_base: endBase,
        duration_planned_base: durationBase as any,
        weight: weight as any,
        baseline_id: baselineId as any,
      } as any);
      setBaselineMsg('Task Baseline created successfully.');
      // Refresh task detail to include latest baselines
      try {
        const res = await apiRequest<any>('GET', `/api/tasks/${id}?include=task_baselines,baseline`);
        const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
        // Fallback include fetch if not provided
        if (!Array.isArray(payload?.task_baselines)) {
          try {
            const list = await listTaskBaselines(id);
            payload.task_baselines = list;
          } catch {}
        }
        setData(payload);
      } catch {}
    } catch (e: any) {
      const status = e?.response?.status;
      const errs = e?.response?.data?.errors;
      let msg = e?.response?.data?.message || e?.message || 'Failed to create Task Baseline.';
      if (errs && typeof errs === 'object') {
        const firstKey = Object.keys(errs)[0];
        const val = errs[firstKey];
        const detail = Array.isArray(val) ? val.join(', ') : String(val ?? '');
        if (detail) msg = `${msg}: ${detail}`;
      }
      setBaselineMsg(`${msg}${status ? ` (HTTP ${status})` : ''}`);
      console.error('Create Task Baseline error:', e?.response || e);
    } finally {
      setBaselineCreating(false);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div>Not found</div>;

  const ass: Assignment[] = Array.isArray(data?.assignments) ? data.assignments : [];
  const deps: Dependency[] = Array.isArray(data?.dependencies) ? data.dependencies : [];

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-3">Task Detail</h2>
      <div className="grid gap-2 border rounded-lg p-4 text-sm">
        <Row label="Title" value={data.title} />
        <Row label="Project" value={data.project?.name ?? data.project_id ?? '-'} />
        <Row label="Milestone" value={data.milestone?.name ?? data.milestone_id ?? '-'} />
        <Row label="Priority" value={data.priority ?? 'Medium'} />
        <Row label="Status" value={data.status ?? 'To Do'} />
        <Row label="Start Planned" value={data.start_planned ?? '-'} />
        <Row label="End Planned" value={data.end_planned ?? '-'} />
        <Row label="Percent" value={`${Number(data.percent_complete ?? 0)}%`} />
      </div>

      <section className="mt-4">
        <h3 className="text-sm font-medium mb-2">Assignments</h3>
        <div className="border rounded-lg">
          {ass.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">No assignments</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b">User</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Role</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Effort (h)</th>
                </tr>
              </thead>
              <tbody>
                {ass.map((a, idx) => {
                  const name = a.user?.name ?? String(a.user_id ?? '');
                  const role = (a.role_on_task ?? '').trim();
                  const eff = (a.estimated_effort_hours ?? null);
                  return (
                    <tr key={idx} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 border-t">{name || '-'}</td>
                      <td className="px-3 py-2 border-t">{role || '-'}</td>
                      <td className="px-3 py-2 border-t">{typeof eff === 'number' ? eff : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-4">
        <h3 className="text-sm font-medium mb-2">Dependencies</h3>
        <div className="border rounded-lg">
          {deps.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">No dependencies</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b">Depends On</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Type</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Lag (days)</th>
                </tr>
              </thead>
              <tbody>
                {deps.map((d, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 border-t">{d.depends_on?.title ?? '-'}</td>
                    <td className="px-3 py-2 border-t">{d.type ?? 'FS'}</td>
                    <td className="px-3 py-2 border-t">{typeof d.lag_days === 'number' ? d.lag_days : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-4">
        <h3 className="text-sm font-medium mb-2">Baselines</h3>
        {!!baselineMsg && (
          <div className="mb-2 text-xs px-2 py-1 rounded border inline-block">
            {baselineMsg}
          </div>
        )}
        <div className="border rounded-lg">
          {(!Array.isArray(data?.task_baselines) || data.task_baselines.length === 0) ? (
            <div className="p-3 text-sm text-neutral-500">No baselines yet.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b">Start (Base)</th>
                  <th className="text-left font-medium px-3 py-2 border-b">End (Base)</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Duration</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Linked</th>
                </tr>
              </thead>
              <tbody>
                {data.task_baselines.map((b: any) => (
                  <tr key={b.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 border-t">{b.start_planned_base ?? '-'}</td>
                    <td className="px-3 py-2 border-t">{b.end_planned_base ?? '-'}</td>
                    <td className="px-3 py-2 border-t">{typeof b.duration_planned_base === 'number' ? `${b.duration_planned_base} days` : '-'}</td>
                    <td className="px-3 py-2 border-t">{b.baseline?.baseline_name ? `Project: ${b.baseline.baseline_name}` : 'Free snapshot'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="mt-3 flex gap-2">
        <a href={`/dashboard/tasks/${id}/edit`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Edit</a>
        <button type="button" onClick={handleCreateBaseline} disabled={baselineCreating} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed">
          {baselineCreating ? 'Creating...' : 'Create Task Baseline'}
        </button>
        <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Back</button>
      </div>
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
