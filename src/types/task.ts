// types/task.ts

export interface TaskDependencyLink {
  id: number;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag_days: number;
  depends_on?: { id: number | null; title: string | null } | null;
  task?: { id: number | null; title: string | null } | null;
}

export interface TaskProgressEntry {
  id: number;
  task_id: number;
  progress_date: string | null;
  percent_complete: number;
  changed_by?: number | null;
  changer?: { id: number | null; name: string | null } | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TaskCostEntry {
  id: number;
  task_id: number;
  incurred_on: string | null;
  amount: number | string;
  category?: string | null;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  progress_entries?: TaskProgressEntry[];
  cost_entries?: TaskCostEntry[];
  created_at: string; // ISO
  updated_at: string; // ISO
  deleted_at?: string | null; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}
