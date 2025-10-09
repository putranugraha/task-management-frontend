// types/status-history.ts

export interface StatusHistory {
  id: number;
  task_id: number;
  from_status: string | null;
  to_status: string;
  changed_by: number | null;
  note: string | null;
  task?: { id: number; title: string } | null;
  changer?: { id: number; name: string } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

