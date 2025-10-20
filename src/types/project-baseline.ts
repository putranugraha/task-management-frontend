// types/project-baseline.ts

export interface ProjectBaseline {
  id: number;
  project_id: number;
  baseline_name: string;
  taken_at: string; // ISO datetime
  note: string | null;
  // Computed by backend on baseline creation (optional presence)
  start_planned_base?: string | null; // YYYY-MM-DD
  end_planned_base?: string | null;   // YYYY-MM-DD
  project?: { id: number; name: string } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}
