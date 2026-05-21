// types/task.ts

export interface TaskDependencyLink {
  id: number;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag_days: number;
  depends_on?: { id: number | null; title: string | null } | null;
  task?: { id: number | null; title: string | null } | null;
}

export interface Task {
  id: number;
  project_id: number;
  milestone_id?: number | null;
  title: string;
  description: string | null;
  priority: string; // 'Low' | 'Medium' | 'High' | custom
  status: string; // default 'To Do'
  start_planned: string | null; // YYYY-MM-DD
  end_planned: string | null; // YYYY-MM-DD
  duration_planned: number | null;
  start_actual: string | null; // YYYY-MM-DD
  end_actual: string | null; // YYYY-MM-DD
  duration_actual: number | null;
  percent_complete: number; // 0-100
  budget_cost?: number | string | null; // IDR budget per task (for cost-based EVM)
  project?: { id: number; name: string } | null;
  milestone?: { id: number; name: string } | null;
  dependencies?: TaskDependencyLink[];
  dependents?: TaskDependencyLink[];
  created_at: string; // ISO
  updated_at: string; // ISO
  deleted_at?: string | null; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}
