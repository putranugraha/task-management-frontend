import { apiRequest } from "@/lib/api";

export async function getProjectEvm(
  projectId: number | string,
  date: string,
  baselineId?: number | null
) {
  const params: Record<string, any> = { date };
  if (baselineId != null) params.baseline_id = baselineId;
  return await apiRequest<any>(
    "GET",
    `/api/projects/${encodeURIComponent(String(projectId))}/evm`,
    undefined,
    { params }
  );
}

