import { apiRequest } from "@/lib/api";
import type { Comment } from "@/types/comment";

export type CreateCommentDto = {
  entity_type: string;
  entity_id: number;
  user_id: number;
  content: string;
};

export async function listComments(
  entityType: string,
  entityId: number | string
): Promise<Comment[]> {
  const params = new URLSearchParams();
  params.set("entity_type", entityType);
  params.set("entity_id", String(entityId));
   // Minta backend untuk meng-include relasi user supaya nama bisa ditampilkan
   params.set("include", "user");

  const res = await apiRequest<Comment[] | { data: Comment[] }>(
    "GET",
    `/api/comments?${params.toString()}`
  );

  return Array.isArray(res) ? res : (res as any)?.data ?? [];
}

export async function createComment(
  dto: CreateCommentDto
): Promise<Comment> {
  const res = await apiRequest<Comment | { data: Comment }>(
    "POST",
    "/api/comments",
    dto as any
  );

  return (res && typeof res === "object" && "data" in res
    ? (res as any).data
    : (res as any)) as Comment;
}
