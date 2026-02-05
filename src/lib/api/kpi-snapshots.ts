import { apiRequest } from "@/lib/api";
import type { KpiSnapshot } from "@/types/kpi-snapshot";

export async function listByProject(
  projectId: number | string,
  periodId?: number | string | null
): Promise<KpiSnapshot[]> {
  const params: string[] = [`project_id=${encodeURIComponent(String(projectId))}`];
  if (periodId != null) {
    params.push(`period_id=${encodeURIComponent(String(periodId))}`);
  }
  const query = params.length ? `?${params.join("&")}` : "";
  const endpoints = [
    `/api/kpi-snapshots${query}`,
    `/api/projects/${encodeURIComponent(String(projectId))}/kpi-snapshots`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await apiRequest<any>("GET", ep);
      // Normalisasi semua bentuk response menjadi array:
      // - [ {...}, {...} ]
      // - { data: [ {...} ] }
      // - { data: {...} }
      // - { ...singleSnapshot }
      let payload: any = res;
      if (payload && typeof payload === "object" && "data" in payload) {
        payload = (payload as any).data;
      }
      if (!payload) return [];
      if (Array.isArray(payload)) {
        return payload as KpiSnapshot[];
      }
      return [payload as KpiSnapshot];
    } catch (e: any) {
      if (e?.response?.status === 404) {
        continue;
      }
      throw e;
    }
  }
  return [];
}

export async function getAverageCycleTimeByProject(
  projectId: number | string
): Promise<number | null> {
  const ep = `/api/projects/${encodeURIComponent(String(projectId))}/kpi-snapshots/average-cycle-time`;
  try {
    const res = await apiRequest<{ average_cycle_time_days?: number } | any>("GET", ep);
    if (res && typeof res === "object" && "average_cycle_time_days" in res) {
      const v = (res as any).average_cycle_time_days;
      const n = typeof v === "number" ? v : Number(v ?? NaN);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  } catch (e: any) {
    if (e?.response?.status === 404) {
      return null;
    }
    throw e;
  }
}

export type GenerateKpiPayload = {
  period_date: string;
  note?: string | null;
};

export async function generateForProject(
  projectId: number | string,
  payload: GenerateKpiPayload
): Promise<KpiSnapshot> {
  const ep = `/api/projects/${encodeURIComponent(String(projectId))}/kpi-snapshots/generate`;
  const res = await apiRequest<any>("POST", ep, payload as any);
  if (res && typeof res === "object" && "data" in res) {
    return (res as any).data as KpiSnapshot;
  }
  return res as KpiSnapshot;
}
