// types/profile.ts

// /api/profile response payload: { user, roles, permissions }
export interface ProfilePayload {
  user: {
    id: number;
    name: string;
    email: string;
    job_title: string | null;
    is_active: boolean;
    status: string;
    last_login_at: string | null; // ISO
    email_verified_at: string | null; // ISO
    division?: { id: number; code: string; name: string } | null;
    role?: string | null;
    created_at: string; // ISO
    updated_at: string; // ISO
  };
  roles: string[]; // role names
  permissions: string[]; // permission names
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export type ProfileResponse = ApiResponse<ProfilePayload>;
