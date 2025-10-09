// types/project-baseline.ts

export interface ProjectBaseline {
  id: number;
  project_id: number;
  baseline_name: string;
  taken_at: string; // ISO datetime
  note: string | null;
  project?: { id: number; name: string } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

