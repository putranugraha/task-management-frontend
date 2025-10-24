"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { createForProject, MILESTONE_STATUS_OPTIONS, type CreateMilestoneDto, listByProject as listMilestonesByProject } from "@/lib/api/milestones";
import { createForMilestone as createTaskForMilestone } from "@/lib/api/tasks";
import { apiRequest } from "@/lib/api";

type FormState = {
  name: string;
  status: string;
  due_planned: string;
  due_actual: string;
};

type FieldErrors = Partial<Record<keyof CreateMilestoneDto, string>> & { [k: string]: string };

export default function CreateProjectMilestonePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [form, setForm] = useState<FormState>({
    name: "",
    status: "Planned",
    due_planned: "",
    due_actual: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Optional: create initial tasks together with milestone
  type TaskForm = {
    tempKey: number;
    title: string;
    status: string;
    priority: string;
    start_planned: string;
    end_planned: string;
    percent_complete: number;
    dependsOnKeys?: number[];
  };
  const [taskForms, setTaskForms] = useState<TaskForm[]>([]);
  const nextKeyRef = useRef(1);
  const addEmptyTask = () => setTaskForms((s) => ([...s, {
    tempKey: nextKeyRef.current++,
    title: "",
    status: "To Do",
    priority: "Medium",
    start_planned: "",
    end_planned: "",
    percent_complete: 0,
    dependsOnKeys: [],
  }]));
  const removeTask = (idx: number) => setTaskForms((s) => s.filter((_, i) => i !== idx));

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => ({ ...s, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: '' }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      // Validate basic fields
      // Basic client-side validation
      if (!form.name || form.name.length > 150) {
        setFieldErrors((e) => ({ ...e, name: 'Name is required and must be <= 150 chars' }));
        setSubmitting(false);
        return;
      }
      if (!MILESTONE_STATUS_OPTIONS.includes(form.status as any)) {
        setFieldErrors((e) => ({ ...e, status: 'Invalid status' }));
        setSubmitting(false);
        return;
      }
      // Validate each task row: start <= end when both provided
      for (let i = 0; i < taskForms.length; i++) {
        const t = taskForms[i];
        if (t.start_planned && t.end_planned) {
          const s = Date.parse(t.start_planned);
          const en = Date.parse(t.end_planned);
          if (Number.isFinite(s) && Number.isFinite(en) && s > en) {
            alert(`Task #${i + 1} has Start after End. Please fix the dates.`);
            setSubmitting(false);
            return;
          }
        }
      }

      // Soft warning A: sequence vs existing milestones in this project
      let duePlanned = form.due_planned || '';
      const dueTs = duePlanned ? Date.parse(duePlanned) : NaN;
      if (projectId && duePlanned && Number.isFinite(dueTs)) {
        try {
          const existing = await listMilestonesByProject(projectId);
          const existDue = (existing || []).map((m: any) => m?.due_planned).filter(Boolean) as string[];
          if (existDue.length) {
            const latest = existDue.sort((a,b) => Date.parse(b) - Date.parse(a))[0];
            if (Date.parse(duePlanned) < Date.parse(latest)) {
              const adjustMsg = `Due Planned (${duePlanned}) lebih awal dari milestone lain (terakhir ${latest}).\n\nRekomendasi: sesuaikan Due Planned menjadi ${latest}.\n\nKlik OK untuk menyesuaikan, Cancel untuk pilihan lain.`;
              const okAdj = confirm(adjustMsg);
              if (okAdj) {
                duePlanned = latest;
              } else {
                const proceed = confirm(`Lanjutkan tanpa menyesuaikan Due Planned (tetap ${duePlanned})?\n\nKlik OK untuk lanjut simpan, Cancel untuk batalkan dan ubah data.`);
                if (!proceed) { setSubmitting(false); return; }
              }
            }
          }
        } catch {}
      }

      // Soft warning B: tasks exceeding milestone due_planned
      if (duePlanned && Number.isFinite(dueTs)) {
        // find max end_planned among provided tasks
        const endDates = taskForms
          .map(t => t.end_planned)
          .filter(Boolean) as string[];
        const maxEnd = endDates.length ? endDates.sort((a,b) => Date.parse(b)-Date.parse(a))[0] : '';
        if (maxEnd && Date.parse(maxEnd) > dueTs) {
          // First prompt: adjust due to max end
          const okAdjust = confirm(`Ada ${endDates.length} task dengan tanggal akhir melebihi Due Planned (${duePlanned}).\n\nRekomendasi: sesuaikan Due Planned menjadi ${maxEnd}.\n\nKlik OK untuk menyesuaikan Due Planned. Klik Cancel untuk pilihan lain.`);
          if (okAdjust) {
            duePlanned = maxEnd;
          } else {
            // Second prompt: continue anyway or cancel submit
            const proceed = confirm(`Lanjutkan tanpa menyesuaikan Due Planned (tetap ${duePlanned})?\n\nKlik OK untuk lanjut simpan, Cancel untuk batalkan dan ubah data.`);
            if (!proceed) {
              setSubmitting(false);
              return;
            }
          }
        }
      }

      const payload: CreateMilestoneDto = {
        name: form.name,
        status: form.status as any,
        due_planned: duePlanned || null,
        // due_actual tidak dikirim saat create; akan diisi otomatis ketika milestone di-mark Complete
      } as any;
      const created = await createForProject(projectId, payload);
      const createdUnwrapped = created && typeof created === 'object' && 'data' in (created as any) ? (created as any).data : created;
      const milestoneId = (createdUnwrapped as any)?.id;
      // Create tasks if provided and milestone was created successfully
      if (milestoneId && Array.isArray(taskForms) && taskForms.length > 0) {
        // Filter rows that at least have a title
        const rows = taskForms.filter(t => (t.title || '').trim().length > 0);
        const createdMap = new Map<number, number>(); // tempKey -> createdId
        const failures: Array<{ title: string; error: unknown }> = [];
        for (const t of rows) {
          try {
            const dto: any = {
              title: t.title,
              status: t.status || 'To Do',
              priority: t.priority || 'Medium',
              start_planned: t.start_planned || null,
              end_planned: t.end_planned || null,
              percent_complete: Number.isFinite(t.percent_complete) ? Number(t.percent_complete) : 0,
              project_id: Number(projectId) || undefined,
              milestone_id: Number(milestoneId) || undefined,
            };
            // translate dependencies to created ids (only previous tasks allowed)
            const depIds = (t.dependsOnKeys || []).map(k => createdMap.get(k)).filter(Boolean) as number[];
            if (depIds.length) {
              dto.dependencies = depIds.map(id => ({ depends_on_task_id: id, type: 'FS', lag_days: 0 }));
            }
            let createdTask: any = null;
            try {
              createdTask = await createTaskForMilestone(milestoneId, dto);
            } catch (err: any) {
              // Fallbacks for diverse backends
              try {
                // Try flat /api/tasks with milestone_id and project_id
                const body1 = { ...dto, milestone_id: Number(milestoneId), project_id: Number(projectId) };
                createdTask = await apiRequest<any>('POST', '/api/tasks', body1);
              } catch (e2: any) {
                // Try nested project route
                const body2 = { ...dto, milestone_id: Number(milestoneId) };
                createdTask = await apiRequest<any>('POST', `/api/projects/${projectId}/tasks`, body2);
              }
            }
            const unwrapped = createdTask && typeof createdTask === 'object' && 'data' in createdTask ? (createdTask as any).data : createdTask;
            const newId = (unwrapped as any)?.id ?? (unwrapped as any)?.task_id ?? (unwrapped as any)?.task?.id;
            if (newId) createdMap.set(t.tempKey, Number(newId));
            else {
              failures.push({ title: t.title, error: createdTask });
            }
          } catch (e) {
            // Keep creating the rest; surface a generic notice
            console.warn('Failed to create a task for milestone', e);
            failures.push({ title: t.title, error: e });
          }
        }
        if (failures.length) {
          try {
            console.error('Some tasks failed to create:', failures);
            alert(`Warning: ${failures.length} task(s) gagal dibuat. Cek konsol untuk detail.`);
          } catch {}
        }
      }
      // Redirect back to Project Detail so the new milestone appears in the detail page section
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e: any) {
      // 422 validation mapping (Laravel)
      const errors = e?.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        const mapped: FieldErrors = {};
        Object.keys(errors).forEach((k) => {
          const val = errors[k];
          mapped[k] = Array.isArray(val) ? val.join(', ') : String(val ?? 'Invalid');
        });
        setFieldErrors(mapped);
      } else if (e?.response?.status === 404) {
        // Some backends use 404 for unauthorized project access (policy hides existence)
        setError('Project not found or you may not have permission');
      } else if (e?.response?.status === 401 || e?.response?.status === 403) {
        setError('Not authorized to perform this action');
      } else {
        setError(e?.message ?? 'Failed to create milestone');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Create Milestone for Project #{projectId}</h2>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={onChange} required maxLength={150} className="w-full border rounded-md px-3 py-2" />
          {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Status</label>
            <select name="status" value={form.status} onChange={onChange} className="w-full border rounded-md px-3 py-2">
              {MILESTONE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {fieldErrors.status && <p className="text-xs text-red-600 mt-1">{fieldErrors.status}</p>}
          </div>
          <div>
            <label className="block text-sm mb-1">Due Planned</label>
            <input type="date" name="due_planned" value={form.due_planned} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
            {fieldErrors.due_planned && <p className="text-xs text-red-600 mt-1">{fieldErrors.due_planned}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Due Actual</label>
          <input
            type="date"
            name="due_actual"
            value={form.due_actual}
            onChange={onChange}
            className="w-full border rounded-md px-3 py-2 bg-neutral-50 text-neutral-500"
            disabled
            readOnly
            placeholder="Auto-filled when milestone is completed"
          />
          <p className="text-xs text-neutral-500 mt-1">Nilai ini akan terisi otomatis saat kamu menandai milestone sebagai Completed.</p>
        </div>
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Tasks (optional)</h3>
            <button type="button" onClick={addEmptyTask} className="px-2 py-1 rounded-md border text-sm hover:bg-neutral-50">Add Task</button>
          </div>
          {taskForms.length === 0 ? (
            <p className="text-xs text-neutral-500">Kamu bisa menambahkan task pertama milestone di sini. Ini opsional.</p>
          ) : (
            <div className="grid gap-3">
              {taskForms.map((t, idx) => (
                <div key={t.tempKey} className="border rounded-md p-3 grid gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-neutral-600">Task #{idx + 1}</div>
                    <button type="button" onClick={() => removeTask(idx)} className="text-xs px-2 py-1 border rounded hover:bg-neutral-50">Remove</button>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Title</label>
                    <input
                      value={t.title}
                      onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))}
                      className="w-full border rounded-md px-3 py-2"
                      placeholder="e.g. Implement Middleware RBAC"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Status</label>
                      <select
                        value={t.status}
                        onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, status: e.target.value } : x))}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option>To Do</option>
                        <option>In Progress</option>
                        <option>Done</option>
                        <option>On Hold</option>
                        <option>Cancelled</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Priority</label>
                      <select
                        value={t.priority}
                        onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, priority: e.target.value } : x))}
                        className="w-full border rounded-md px-3 py-2"
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Critical</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm mb-1">Start Planned</label>
                      <input type="date" value={t.start_planned}
                        onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, start_planned: e.target.value } : x))}
                        className="w-full border rounded-md px-3 py-2" />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">End Planned</label>
                      <input type="date" value={t.end_planned}
                        onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, end_planned: e.target.value } : x))}
                        className="w-full border rounded-md px-3 py-2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Percent Complete</label>
                    <input type="number" min={0} max={100} value={t.percent_complete}
                      onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, percent_complete: Number(e.target.value || 0) } : x))}
                      className="w-full border rounded-md px-3 py-2" />
                  </div>
                  {idx > 0 && (
                    <div>
                      <label className="block text-sm mb-1">Depends On (previous tasks)</label>
                      <div className="border rounded-md p-2 max-h-40 overflow-auto text-sm">
                        {taskForms.slice(0, idx).map((cand, cidx) => {
                          const checked = (t.dependsOnKeys || []).includes(cand.tempKey);
                          const label = (cand.title && cand.title.trim()) ? cand.title : `Task #${cidx + 1}`;
                          return (
                            <label key={cand.tempKey} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={checked}
                                onChange={(e) => {
                                  setTaskForms((s) => s.map((x, i) => {
                                    if (i !== idx) return x;
                                    const set = new Set(x.dependsOnKeys || []);
                                    if (e.target.checked) set.add(cand.tempKey); else set.delete(cand.tempKey);
                                    return { ...x, dependsOnKeys: Array.from(set) };
                                  }));
                                }}
                              />
                              <span className="truncate">{label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">Default type FS, lag 0. Dukungan tipe/lag akan ditambahkan berikutnya.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={submitting} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{submitting ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
