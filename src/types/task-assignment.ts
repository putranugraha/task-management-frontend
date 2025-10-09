// types/task-assignment.ts

export interface TaskAssignment {
  id: number;
  task_id: number;
  user_id: number;
  role_on_task: string; // e.g. Manager, Member
  estimated_effort_hours: number | null;
  assigned_at: string | null; // ISO
  task?: { id: number; title: string } | null;
  user?: { id: number; name: string; email: string } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

