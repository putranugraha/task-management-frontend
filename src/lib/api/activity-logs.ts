import { apiRequest } from "@/lib/api";

export type ActivityLog = {
  id: number;
  log_name: string | null;
  event: string | null;
  time: string | null;
  actor_id: number | null;
  actor_name: string | null;
  subject_type: string | null;
  subject_id: number | null;
  properties: unknown;
};

export async function listActivityLogs(params?: {
  log_name?: string;
  page?: number;
  per_page?: number;
}): Promise<ActivityLog[]> {
  const search = new URLSearchParams();
  if (params?.log_name) search.set("log_name", params.log_name);
  if (params?.page) search.set("page", String(params.page));
  if (params?.per_page) search.set("per_page", String(params.per_page));

  const qs = search.toString();
  const url = `/api/activity-logs${qs ? `?${qs}` : ""}`;

  const res = await apiRequest<ActivityLog[] | { data: ActivityLog[] }>("GET", url);
  return Array.isArray(res) ? res : (res as any).data ?? [];
}

