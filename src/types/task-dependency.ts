// types/task-dependency.ts

export interface TaskDependency {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  type: 'FS' | 'SS' | 'FF' | 'SF';
  lag_days: number;
  task?: { id: number; title: string } | null;
  depends_on?: { id: number; title: string } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

