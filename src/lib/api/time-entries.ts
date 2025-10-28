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
  return await apiRequest<any>("POST", "/api/time-entries/upsert", payload as any);
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
