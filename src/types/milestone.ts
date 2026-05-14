// types/milestone.ts

export type MilestoneStatus = 'Planned' | 'In Progress' | 'Completed' | 'Overdue' | 'On Hold';

export interface Milestone {
  id: number;
  project_id: number;
  name: string;
  due_planned: string | null; // YYYY-MM-DD
  due_actual: string | null; // YYYY-MM-DD
  status: MilestoneStatus; // default 'Planned'
  project?: { id: number; name: string } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
  deleted_at?: string | null; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}
