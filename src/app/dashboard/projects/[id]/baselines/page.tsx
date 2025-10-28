"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { listByProject as listTasksByProject } from "@/lib/api/tasks";
import { listByTask as listTaskBaselines, listByBaseline as listTaskBaselinesByBaseline, create as createTaskBaseline } from "@/lib/api/task-baselines";

type ProjectBaseline = {
  id: number;
  baseline_name: string;
  taken_at?: string | null;
  start_planned_base?: string | null;
  end_planned_base?: string | null;
  note?: string | null;
};

export default function ProjectBaselinesPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [rows, setRows] = useState<ProjectBaseline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [openRow, setOpenRow] = useState<Record<number, boolean>>({});
  const [taskBaselinesMap, setTaskBaselinesMap] = useState<Record<number, any[]>>({});
  const [taskBaselinesLoading, setTaskBaselinesLoading] = useState<Record<number, boolean>>({});
  const [taskBaselinesError, setTaskBaselinesError] = useState<Record<number, string | null>>({});

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true); setError(null);
      try {
        const res = await apiRequest<ProjectBaseline[] | { data: ProjectBaseline[] }>('GET', `/api/project-baselines?project_id=${encodeURIComponent(String(projectId))}`);
        const arr = Array.isArray(res) ? res : ((res as any)?.data ?? []);
        arr.sort((a: any, b: any) => {
          const ta = a.taken_at ? Date.parse(a.taken_at) : 0;
          const tb = b.taken_at ? Date.parse(b.taken_at) : 0;
          if (tb !== ta) return tb - ta;
          return (b.id ?? 0) - (a.id ?? 0);
        });
        if (mounted) setRows(arr as ProjectBaseline[]);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load baselines');
      } finally {
        setLoading(false);
      }
    }
    if (projectId) run();
    return () => { mounted = false; };
  }, [projectId]);

  const exportCsv = () => {
    const header = ['Baseline','Taken At','Start Base','End Base','Note'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const line = [r.baseline_name, r.taken_at || '', (r as any).start_planned_base || '', (r as any).end_planned_base || '', r.note || '']
        .map(s => '"' + String(s).replace(/"/g,'""') + '"').join(',');
      lines.push(line);
    }
    const text = lines.join('\n');
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'project-baselines.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const createTaskBaselinesFor = async (baseline: ProjectBaseline) => {
    if (!projectId) return;
    const ok = confirm(`Create Task Baselines for baseline "${baseline.baseline_name}"?`);
    if (!ok) return;
    setBusyRow(baseline.id);
    try {
      const tasks: any[] = await listTasksByProject(projectId);
      let createdCount = 0; let skipped = 0; let failed = 0;
      for (const t of (tasks || [])) {
        const id = Number(t?.id); if (!Number.isFinite(id)) continue;
        const s = t?.start_planned || null; const e = t?.end_planned || null;
        if (!s || !e) { skipped++; continue; }
        try {
          // Dedup: skip when baseline for this task already exists for this project baseline
          const existing = await listTaskBaselines(id).catch(() => [] as any[]);
          if (Array.isArray(existing) && existing.some((b: any) => Number(b?.baseline_id) === Number(baseline.id))) { skipped++; continue; }
          const duration = (Number.isFinite(Date.parse(e)) && Number.isFinite(Date.parse(s)))
            ? (Math.max(0, Math.round((Date.parse(e) - Date.parse(s)) / (24*60*60*1000))) + 1) : null;
          const hoursPerDay = 8;
          const plannedHours = (duration != null) ? duration * hoursPerDay : null;
          await createTaskBaseline(id, {
            baseline_id: Number(baseline.id) as any,
            start_planned_base: s,
            end_planned_base: e,
            duration_planned_base: duration as any,
            // keep minimal weight for compatibility
            weight: 1 as any,
            // provide planned effort hints for backends expecting hours-based PV
            planned_effort_hours: plannedHours as any,
            planned_hours: plannedHours as any,
            effort_hours: plannedHours as any,
            planned_effort: plannedHours as any,
            effort_planned: plannedHours as any,
          } as any);
          createdCount++;
        } catch {
          failed++;
        }
      }
      alert(`Done. Created: ${createdCount}, Skipped: ${skipped}, Failed: ${failed}`);
    } finally {
      setBusyRow(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-3 flex items-center gap-2">
        <a href={`/dashboard/projects/${projectId}`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Back</a>
        <h2 className="text-xl font-semibold">Project Baselines</h2>
        <button onClick={exportCsv} className="ml-auto px-2 py-1 rounded-md border text-sm hover:bg-neutral-50">Export CSV</button>
      </div>
      {error && <div className="mb-2 text-sm text-red-600">{error}</div>}
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-700">
            <tr>
              <th className="text-left font-medium px-3 py-2 border-b w-20">Tasks</th>
              <th className="text-left font-medium px-3 py-2 border-b">Baseline</th>
              <th className="text-left font-medium px-3 py-2 border-b">Taken At</th>
              <th className="text-left font-medium px-3 py-2 border-b">Start (Base)</th>
              <th className="text-left font-medium px-3 py-2 border-b">End (Base)</th>
              <th className="text-left font-medium px-3 py-2 border-b">Note</th>
              <th className="text-left font-medium px-3 py-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-3 text-neutral-500" colSpan={6}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-3 py-3 text-neutral-500" colSpan={6}>No baselines</td></tr>
            ) : (
              rows.map((r) => (
                <>
                  <tr key={`row-${r.id}`} className="hover:bg-neutral-50 align-top">
                    <td className="px-3 py-2 border-t">
                      <button
                        type="button"
                        className="px-2 py-1 rounded-md border text-xs hover:bg-neutral-50"
                        onClick={async () => {
                          setOpenRow(s => ({ ...s, [r.id]: !s[r.id] }));
                          const open = !openRow[r.id];
                          if (open) {
                            // Lazy load task baselines for this baseline
                            if (!taskBaselinesMap[r.id] || taskBaselinesMap[r.id].length === 0) {
                              setTaskBaselinesLoading(s => ({ ...s, [r.id]: true }));
                              setTaskBaselinesError(s => ({ ...s, [r.id]: null }));
                              try {
                                const list = await listTaskBaselinesByBaseline(r.id);
                                setTaskBaselinesMap(s => ({ ...s, [r.id]: Array.isArray(list) ? list : [] }));
                              } catch (e: any) {
                                setTaskBaselinesError(s => ({ ...s, [r.id]: e?.message ?? 'Failed to load task baselines' }));
                              } finally {
                                setTaskBaselinesLoading(s => ({ ...s, [r.id]: false }));
                              }
                            }
                          }
                        }}
                      >{openRow[r.id] ? 'Hide' : 'View'}</button>
                    </td>
                    <td className="px-3 py-2 border-t">{r.baseline_name}</td>
                    <td className="px-3 py-2 border-t">{r.taken_at || '-'}</td>
                    <td className="px-3 py-2 border-t">{(r as any).start_planned_base || '-'}</td>
                    <td className="px-3 py-2 border-t">{(r as any).end_planned_base || '-'}</td>
                    <td className="px-3 py-2 border-t">{r.note || '-'}</td>
                    <td className="px-3 py-2 border-t">
                      <button
                        className="px-2 py-1 rounded-md border text-sm hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={busyRow === r.id}
                        onClick={() => createTaskBaselinesFor(r)}
                      >Create Task Baselines</button>
                    </td>
                  </tr>
                  {openRow[r.id] && (
                    <tr key={`detail-${r.id}`}>
                      <td className="px-3 py-2 border-t bg-neutral-50/60" colSpan={7}>
                        {taskBaselinesLoading[r.id] ? (
                          <div className="text-xs text-neutral-600">Loading task baselines…</div>
                        ) : taskBaselinesError[r.id] ? (
                          <div className="text-xs text-red-600">{taskBaselinesError[r.id]}</div>
                        ) : (taskBaselinesMap[r.id] || []).length === 0 ? (
                          <div className="text-xs text-neutral-600">No task baselines for this baseline.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead className="bg-neutral-100 text-neutral-700">
                                <tr>
                                  <th className="text-left font-medium px-2 py-1 border-b">Task</th>
                                  <th className="text-left font-medium px-2 py-1 border-b">Start (Base)</th>
                                  <th className="text-left font-medium px-2 py-1 border-b">End (Base)</th>
                                  <th className="text-left font-medium px-2 py-1 border-b">Duration</th>
                                  <th className="text-left font-medium px-2 py-1 border-b">Weight</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(taskBaselinesMap[r.id] || []).map((tb: any) => (
                                  <tr key={tb.id} className="hover:bg-neutral-50">
                                    <td className="px-2 py-1 border-t">
                                      {tb?.task?.title || tb?.task_title || `Task #${tb?.task_id ?? '-'}`}
                                    </td>
                                    <td className="px-2 py-1 border-t">{tb?.start_planned_base ?? '-'}</td>
                                    <td className="px-2 py-1 border-t">{tb?.end_planned_base ?? '-'}</td>
                                    <td className="px-2 py-1 border-t">{tb?.duration_planned_base ?? '-'}</td>
                                    <td className="px-2 py-1 border-t">{tb?.weight ?? '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
