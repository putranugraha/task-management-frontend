import { apiRequest } from "@/lib/api";

export type TaskCostEntry = {
  id: number;
  task_id: number;
  incurred_on: string; // YYYY-MM-DD
  amount: number | string;
  category?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateTaskCostEntryDto = {
  incurred_on: string; // YYYY-MM-DD
  amount: number | string;
  category?: string | null;
  note?: string | null;
};

export async function listByTask(
  taskId: number | string,
  opts?: { asOf?: string; limit?: number }
) {
  const id = encodeURIComponent(String(taskId));
  const qs = new URLSearchParams();
  if (opts?.asOf) qs.set("date", String(opts.asOf));
  if (opts?.limit) qs.set("limit", String(opts.limit));
  const url = `/api/tasks/${id}/cost-entries${
    qs.toString() ? `?${qs.toString()}` : ""
  }`;
  const res = await apiRequest<TaskCostEntry[] | { data: TaskCostEntry[] }>(
    "GET",
    url
  );
  return Array.isArray(res) ? res : (res as any)?.data ?? [];
}

export async function createForTask(
  taskId: number | string,
  dto: CreateTaskCostEntryDto
) {
  const id = encodeURIComponent(String(taskId));
  const res = await apiRequest<TaskCostEntry | { data: TaskCostEntry }>(
    "POST",
    `/api/tasks/${id}/cost-entries`,
    dto as any
  );
  return (res && typeof res === "object" && "data" in (res as any))
    ? ((res as any).data as TaskCostEntry)
    : (res as TaskCostEntry);
}

export async function remove(taskId: number | string, entryId: number | string) {
  const tid = encodeURIComponent(String(taskId));
  const eid = encodeURIComponent(String(entryId));
  await apiRequest("DELETE", `/api/tasks/${tid}/cost-entries/${eid}`);
}
