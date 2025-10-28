import { apiRequest } from "@/lib/api";

export type CreateTaskBaselineDto = {
  task_id: number;
  // Optional: allow backend-specific hints if ever needed
  baseline_id?: number | null;
};

export async function create(taskId: number | string, extra?: Partial<CreateTaskBaselineDto>) {
  const id = Number(taskId);
  const baseBody: any = { task_id: id, taskId: id, ...(extra as any) };
  // Try common REST shapes for different backends
  const endpoints = [
    { method: 'POST', url: `/api/tasks/${encodeURIComponent(String(id))}/baselines`, body: {} },
    { method: 'POST', url: `/api/tasks/${encodeURIComponent(String(id))}/task-baselines`, body: {} },
    { method: 'POST', url: `/api/task-baselines`, body: baseBody },
  ] as const;
  let lastErr: any;
  for (const ep of endpoints) {
    try {
      const body = Object.keys(ep.body).length ? ep.body : baseBody;
      return await apiRequest<any>(ep.method, ep.url, body);
    } catch (e: any) {
      // Continue on 404/405 to try next conventional route
      if (e?.response?.status === 404 || e?.response?.status === 405) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Failed to create task baseline');
}

export async function listByTask(taskId: number | string) {
  const id = encodeURIComponent(String(taskId));
  const endpoints = [
    `/api/tasks/${id}/baselines`,
    `/api/tasks/${id}/task-baselines`,
    `/api/task-baselines?task_id=${id}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await apiRequest<any[] | { data: any[] }>('GET', ep);
      return Array.isArray(res) ? res : (res as any)?.data ?? [];
    } catch (e: any) {
      if (e?.response?.status === 404) continue;
      throw e;
    }
  }
  return [];
}

export async function listByBaseline(baselineId: number | string) {
  const id = encodeURIComponent(String(baselineId));
  const endpoints = [
    `/api/task-baselines?baseline_id=${id}&include=task`,
    `/api/project-baselines/${id}/task-baselines?include=task`,
    `/api/task-baselines?baseline_id=${id}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await apiRequest<any[] | { data: any[] }>('GET', ep);
      return Array.isArray(res) ? res : (res as any)?.data ?? [];
    } catch (e: any) {
      if (e?.response?.status === 404) continue;
      throw e;
    }
  }
  return [];
}

// Optional flat creator to match BE route: POST /api/task-baselines
export async function createFlat(payload: {
  task_id: number;
  start_planned_base: string;
  end_planned_base: string;
  baseline_id?: number;
  planned_effort_hours?: number;
  weight?: number;
}) {
  return await apiRequest<any>('POST', `/api/task-baselines`, payload as any);
}
