// types/project.ts

export interface Project {
  id: number;
  name: string;
  client_name: string;
  value_amount: number; // decimal(15,2) cast to number in resource
  scope: string | null;
  objective: string | null;
  division_owner_id: number | null;
  division_owner?: { id: number; name: string; email: string } | null;
  start_planned: string | null; // YYYY-MM-DD
  end_planned: string | null; // YYYY-MM-DD
  status: string; // default 'Planned'
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

