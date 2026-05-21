// types/user.ts

export interface User {
  id: number;
  name: string;
  email: string;
  job_title: string | null;
  is_active: boolean;
  status: string; // 'Aktif' or custom
  last_login_at: string | null; // ISO datetime
  email_verified_at: string | null; // ISO datetime
  division?: { id: number; code: string; name: string } | null;
  role?: string | null; // first role name
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}
