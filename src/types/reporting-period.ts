// types/reporting-period.ts

export interface ReportingPeriod {
  id: number;
  project_id: number;
  period_date: string; // YYYY-MM-DD
  note: string | null;
  project?: { id: number; name: string; status: string } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

