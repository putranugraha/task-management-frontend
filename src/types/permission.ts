// types/permission.ts

export interface Permission {
  id: number;
  name: string;
  status: 'Aktif' | 'Non Aktif' | null; // resource may provide null
  created_at: string; // ISO datetime
  updated_at: string; // ISO datetime
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}
