// types/role.ts
export interface Role {
  id: number;
  name: string;
  status: 'Aktif' | 'Non Aktif';
  permissions: string[];
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}
