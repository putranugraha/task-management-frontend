import { apiRequest } from "@/lib/api";
import type { Task } from "@/types/task";

export type TaskStatus = string; // backend-defined; typical: 'To Do' | 'In Progress' | 'Done'

export type CreateTaskDto = {
  title: string;
  description?: string | null;
  priority?: string;
  status?: TaskStatus;
  start_planned?: string | null; // YYYY-MM-DD
  end_planned?: string | null;   // YYYY-MM-DD
  percent_complete?: number;     // 0-100
  project_id?: number;           // some backends require project_id even in nested route
};

export type UpdateTaskDto = Partial<CreateTaskDto>;

export async function listByProject(projectId: number | string): Promise<Task[]> {
  const id = encodeURIComponent(String(projectId));
  // Try to include assignees eagerly when backend supports it.
  const endpoints = [
    // Prefer fetching dependencies so Gantt can render connectors
    `/api/projects/${id}/tasks?include=dependencies,milestone,assignments,users`,
    `/api/projects/${id}/tasks?include=dependencies,milestone,assignments`,
    `/api/projects/${id}/tasks?include=dependencies,milestone,users`,
    `/api/projects/${id}/tasks?include=dependencies,milestone`,
    `/api/tasks?project_id=${id}&include=dependencies,milestone,assignments,users`,
    `/api/tasks?project_id=${id}&include=dependencies,milestone,assignments`,
    `/api/tasks?project_id=${id}&include=dependencies,milestone,users`,
    `/api/tasks?project_id=${id}&include=dependencies,milestone`,
    // Original includes (without dependencies) as graceful fallback
    `/api/projects/${id}/tasks?include=milestone,assignments,users`,
    `/api/projects/${id}/tasks?include=milestone,assignments`,
    `/api/projects/${id}/tasks?include=milestone,users`,
    `/api/projects/${id}/tasks?include=milestone`,
    `/api/tasks?project_id=${id}&include=milestone,assignments,users`,
    `/api/tasks?project_id=${id}&include=milestone,assignments`,
    `/api/tasks?project_id=${id}&include=milestone,users`,
    `/api/tasks?project_id=${id}&include=milestone`,
    // Some backends use "relations" or "with" param names
    `/api/projects/${id}/tasks?relations=dependencies,milestone`,
    `/api/tasks?project_id=${id}&relations=dependencies,milestone`,
    `/api/projects/${id}/tasks?with=dependencies,milestone`,
    `/api/tasks?project_id=${id}&with=dependencies,milestone`,
    `/api/tasks?project_id=${id}`,
  ];
  for (const ep of endpoints) {
    try {
      const res = await apiRequest<Task[] | { data: Task[] }>('GET', ep);
      return Array.isArray(res) ? res : (res as any).data ?? [];
    } catch (e: any) {
      if (e?.response?.status === 404) continue;
      throw e;
    }
  }
  return [];
}

export async function listByMilestone(milestoneId: number | string): Promise<Task[]> {
  const res = await apiRequest<Task[] | { data: Task[] }>('GET', `/api/milestones/${milestoneId}/tasks`);
  return Array.isArray(res) ? res : (res as any).data ?? [];
}

export async function createForMilestone(milestoneId: number | string, dto: CreateTaskDto): Promise<Task> {
  // Include milestone_id and optionally project_id for backend compatibility
  const body = { ...(dto as any), milestone_id: Number(milestoneId) };
  return await apiRequest<Task>('POST', `/api/milestones/${milestoneId}/tasks`, body);
}

export async function getById(id: number | string): Promise<Task> {
  const res = await apiRequest<Task | { data: Task }>('GET', `/api/tasks/${id}`);
  return (res && typeof res === 'object' && 'data' in res) ? (res as any).data : (res as any);
}

export async function update(id: number | string, dto: UpdateTaskDto): Promise<Task> {
  return await apiRequest<Task>('PUT', `/api/tasks/${id}`, dto as any);
}

export async function remove(id: number | string): Promise<void> {
  await apiRequest('DELETE', `/api/tasks/${id}`);
}

export async function updateStatus(id: number | string, status: TaskStatus): Promise<Task> {
  return await apiRequest<Task>('PATCH', `/api/tasks/${id}/status`, { status });
}

export async function updateProgress(id: number | string, percent_complete: number): Promise<Task> {
  return await apiRequest<Task>('PATCH', `/api/tasks/${id}/progress`, { percent_complete });
}

export async function complete(id: number | string): Promise<Task> {
  return await apiRequest<Task>('PATCH', `/api/tasks/${id}/complete`);
}
