// types/task-baseline.ts

export interface TaskBaseline {
  id: number;
  baseline_id: number;
  task_id: number;
  start_planned_base: string | null; // YYYY-MM-DD
  end_planned_base: string | null; // YYYY-MM-DD
  duration_planned_base: number | null;
  weight: number; // decimal(8,2)
  baseline?: {
    id: number;
    baseline_name: string;
    project?: { id: number; name: string } | null;
  } | null;
  task?: { id: number; title: string; project_id: number } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

