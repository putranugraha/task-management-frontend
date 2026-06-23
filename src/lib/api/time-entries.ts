import { apiRequest } from "@/lib/api";

export type TimeEntryPayload = {
  task_id: number;
  user_id: number;
  date: string; // YYYY-MM-DD
  hours: number; // decimal
  note?: string | null;
  // Optional progress to be appended to note by backend
  // Does NOT update task percent_complete; call saveProgress as well if needed
  progress?: number;
};

export async function upsert(payload: TimeEntryPayload) {
  const taskId = payload.task_id;
  // Prefer new nested route when available, but keep backward compatibility
  const endpoints = [
    {
      url: `/api/tasks/${encodeURIComponent(String(taskId))}/time-entries/upsert`,
      body: payload as any,
    },
    {
      url: "/api/time-entries/upsert",
      body: payload as any,
    },
  ] as const;

  let lastErr: any;
  for (const ep of endpoints) {
    try {
      return await apiRequest<any>("POST", ep.url, ep.body);
    } catch (e: any) {
      const status = e?.response?.status;
      // Only fall back on classic "route not found / method not allowed"
      if (status === 404 || status === 405) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error("Failed to save time entry");
}

export async function startTaskTimer(taskId: number | string) {
  return apiRequest<{
    message?: string;
    task_id?: number;
    status?: string;
    start_actual?: string | null;
  }>("POST", `/api/tasks/${encodeURIComponent(String(taskId))}/time-entries/start`, {});
}

export async function listByTask(taskId: number | string) {
  const res = await apiRequest<any[] | { data: any[] }>("GET", `/api/tasks/${taskId}/time-entries`);
  return Array.isArray(res) ? res : (res as any)?.data ?? [];
}

export async function totalByTask(taskId: number | string) {
  const res = await apiRequest<any | { data: any }>("GET", `/api/tasks/${taskId}/time-entries/total-hours`);
  const payload = (res && typeof res === 'object' && 'data' in (res as any)) ? (res as any).data : res;
  // Normalize various common shapes to a number
  const tryNum = (v: any): number | null => {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v === 'object') {
      const candidates = [
        (v as any).total,
        (v as any).total_hours,
        (v as any).hours,
        (v as any).sum,
        (v as any).value,
        (v as any).count,
      ];
      for (const c of candidates) {
        const n = tryNum(c);
        if (n != null) return n;
      }
    }
    return null;
  };
  const n = tryNum(payload);
  return n != null ? n : 0;
}
