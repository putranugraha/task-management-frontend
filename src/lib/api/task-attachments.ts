import { apiRequest } from "@/lib/api";

export type TaskAttachmentStatus = "Pending" | "Approved" | "Rejected" | string;

export type TaskAttachment = {
  id: number;
  filename: string;
  mime: string | null;
  size: number;
  url: string;
  status: TaskAttachmentStatus;
  uploaded_at: string | null;
  verified_at?: string | null;
  verified_by?: { id: number; name: string } | null;
};

export async function listByTask(taskId: number | string): Promise<TaskAttachment[]> {
  const res = await apiRequest<TaskAttachment[] | { data: TaskAttachment[] }>(
    "GET",
    `/api/tasks/${taskId}/attachments`
  );
  return Array.isArray(res) ? res : (res as any)?.data ?? [];
}

export async function uploadForTask(taskId: number | string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return await apiRequest<any>("POST", `/api/tasks/${taskId}/attachments`, form);
}

export async function approveAttachment(id: number | string) {
  return await apiRequest<any>("PATCH", `/api/attachments/${id}/approve`);
}

export async function rejectAttachment(id: number | string) {
  return await apiRequest<any>("PATCH", `/api/attachments/${id}/reject`);
}

