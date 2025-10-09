// types/kpi-snapshot.ts

export interface KpiSnapshot {
  id: number;
  project_id: number;
  period_id: number;
  tasks_total: number;
  tasks_done: number;
  overdue_count: number;
  avg_cycle_time_days: number; // decimal(6,2) -> number
  project?: { id: number; name: string; status: string } | null;
  reporting_period?: { id: number; period_date: string | null } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

