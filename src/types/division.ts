// types/division.ts

export interface Division {
  id: number; // bigint
  code: string; // varchar(50)
  name: string; // varchar(255)
  description: string | null; // text
  status?: 'Aktif' | 'Non Aktif';
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
  // present when controller adds withCount('users') and resource returns it
  users_count?: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}
