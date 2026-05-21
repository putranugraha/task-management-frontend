import { apiRequest } from "@/lib/api";
import type { ReportingPeriod } from "@/types/reporting-period";

export async function listByProject(projectId: number | string): Promise<ReportingPeriod[]> {
  const endpoints = [
    `/api/projects/${encodeURIComponent(String(projectId))}/reporting-periods`,
    `/api/reporting-periods?project_id=${encodeURIComponent(String(projectId))}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await apiRequest<ReportingPeriod[] | { data: ReportingPeriod[] }>("GET", ep);
      return Array.isArray(res) ? res : ((res as any)?.data ?? []);
    } catch (e: any) {
      if (e?.response?.status === 404) {
        continue;
      }
      throw e;
    }
  }
  return [];
}

