// types/time-entry.ts

export interface TimeEntry {
  id: number;
  task_id: number;
  user_id: number;
  date: string; // YYYY-MM-DD
  hours: number; // decimal(5,2) -> number
  note: string | null;
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

