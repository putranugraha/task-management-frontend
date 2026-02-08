import { apiRequest } from "@/lib/api";

export type ProjectTimeEntriesTotalResponse = {
  project_id: number;
  as_of: string; // YYYY-MM-DD
  total_hours: number | string;
};

export type ProjectTopTaskByHours = {
  task_id: number;
  task_title: string | null;
  total_hours: number | string;
};

export type ProjectTopTasksByHoursResponse = {
  project_id: number;
  as_of: string; // YYYY-MM-DD
  limit: number;
  items: ProjectTopTaskByHours[];
};

export async function totalHoursByProjectAsOf(
  projectId: number | string,
  asOf: string
): Promise<number> {
  const res = await apiRequest<ProjectTimeEntriesTotalResponse | { data: ProjectTimeEntriesTotalResponse }>(
    "GET",
    `/api/projects/${encodeURIComponent(String(projectId))}/time-entries/total-hours`,
    undefined,
    { params: { date: asOf } }
  );
  const payload =
    res && typeof res === "object" && "data" in (res as any)
      ? (res as any).data
      : (res as any);
  const v = (payload as any)?.total_hours;
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function topTasksByHoursAsOf(
  projectId: number | string,
  asOf: string,
  limit = 5
): Promise<ProjectTopTaskByHours[]> {
  const res = await apiRequest<ProjectTopTasksByHoursResponse | { data: ProjectTopTasksByHoursResponse }>(
    "GET",
    `/api/projects/${encodeURIComponent(String(projectId))}/time-entries/top-tasks`,
    undefined,
    { params: { date: asOf, limit } }
  );
  const payload =
    res && typeof res === "object" && "data" in (res as any)
      ? (res as any).data
      : (res as any);
  const items = Array.isArray((payload as any)?.items) ? (payload as any).items : [];
  return items as ProjectTopTaskByHours[];
}

