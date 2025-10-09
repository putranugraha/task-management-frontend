// types/attachment.ts

export interface Attachment {
  id: number;
  entity_type: string;
  entity_id: number;
  uploaded_by: number | null;
  filename: string;
  mime: string | null;
  storage_path: string;
  size: number; // unsigned bigint -> number
  uploaded_at: string | null; // ISO
  entity?: { type: string; id: number } | null;
  uploader?: { id: number; name: string; email: string } | null;
  created_at: string; // ISO
  updated_at: string; // ISO
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

