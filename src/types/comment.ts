// types/comment.ts

export interface Comment {
  id: number;
  entity_type: string;
  entity_id: number;
  user_id: number;
  content: string;
  entity?: { type: string; id: number; title?: string; name?: string } | null;
  user?: { id: number; name: string; email: string } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

