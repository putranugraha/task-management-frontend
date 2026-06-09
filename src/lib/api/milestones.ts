import { apiRequest } from "@/lib/api";
import type { Milestone, MilestoneStatus } from "@/types/milestone";

export type CreateMilestoneDto = {
  name: string;
  status: MilestoneStatus;
  due_planned?: string | null; // YYYY-MM-DD
  due_actual?: string | null;  // YYYY-MM-DD
  // project_id comes from route (nested), not body
};

export type UpdateMilestoneDto = Partial<CreateMilestoneDto> & {
  name?: string;
  status?: MilestoneStatus;
};

export type ArchivedMilestonePage = {
  data: Milestone[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from?: number | null;
    to?: number | null;
  };
};

export async function listByProject(projectId: number | string): Promise<Milestone[]> {
  const endpoints = [
    `/api/projects/${projectId}/milestones`,
    `/api/project/${projectId}/milestones`,
    `/api/milestones?project_id=${encodeURIComponent(String(projectId))}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await apiRequest<Milestone[] | { data: Milestone[] }>('GET', ep);
      return Array.isArray(res) ? res : (res as any).data ?? [];
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // Try next endpoint
        continue;
      }
      // For non-404 (e.g., 401/500), rethrow
      throw e;
    }
  }
  // If all tried endpoints 404, treat as empty list for UX resilience
  return [];
}

export async function createForProject(projectId: number | string, dto: CreateMilestoneDto): Promise<Milestone> {
  try {
    const body = { ...(dto as any), project_id: Number(projectId) };
    return await apiRequest<Milestone>('POST', `/api/projects/${projectId}/milestones`, body);
  } catch (e: any) {
    if (e?.response?.status === 404) {
      // Try alternate singular route
      const body = { ...(dto as any), project_id: Number(projectId) };
      try {
        return await apiRequest<Milestone>('POST', `/api/project/${projectId}/milestones`, body);
      } catch (e2: any) {
        if (e2?.response?.status === 404) {
          // Final fallback: flat endpoint expecting project_id in payload
          return await apiRequest<Milestone>('POST', `/api/milestones`, body);
        }
        throw e2;
      }
    }
    throw e;
  }
}

export async function getById(id: number | string): Promise<Milestone> {
  const res = await apiRequest<Milestone | { data: Milestone }>('GET', `/api/milestones/${id}`);
  return (res && typeof res === 'object' && 'data' in res) ? (res as any).data : (res as any);
}

export async function update(id: number | string, dto: UpdateMilestoneDto): Promise<Milestone> {
  return await apiRequest<Milestone>('PUT', `/api/milestones/${id}`, dto as any);
}

export async function remove(id: number | string): Promise<void> {
    await apiRequest('DELETE', `/api/milestones/${id}`);
}

export async function listArchived(params?: { project_id?: number | string; search?: string; page?: number; per_page?: number }): Promise<ArchivedMilestonePage> {
  const query = new URLSearchParams();
  if (params?.project_id) query.set('project_id', String(params.project_id));
  if (params?.search?.trim()) query.set('search', params.search.trim());
  if (params?.page) query.set('page', String(params.page));
  if (params?.per_page) query.set('per_page', String(params.per_page));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiRequest<Milestone[] | ArchivedMilestonePage>('GET', `/api/milestones/archived${suffix}`);
  if (Array.isArray(res)) {
    return { data: res, meta: { current_page: 1, last_page: 1, per_page: res.length || 10, total: res.length } };
  }
  return res as ArchivedMilestonePage;
}

export async function restore(id: number | string): Promise<Milestone> {
  return await apiRequest<Milestone>('PATCH', `/api/milestones/${id}/restore`);
}

export async function updateStatus(id: number | string, status: MilestoneStatus): Promise<Milestone> {
  return await apiRequest<Milestone>('PATCH', `/api/milestones/${id}/status`, { status });
}

export async function complete(id: number | string): Promise<Milestone> {
  return await apiRequest<Milestone>('PATCH', `/api/milestones/${id}/complete`);
}

export const MILESTONE_STATUS_OPTIONS: MilestoneStatus[] = [
  'Planned', 'In Progress', 'Completed', 'Overdue', 'On Hold'
];
