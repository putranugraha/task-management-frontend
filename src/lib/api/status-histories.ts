import { apiRequest } from "@/lib/api";
import type { StatusHistory } from "@/types/status-history";

type MaybePaginated<T> = T[] | { data: T[]; meta?: unknown };

export async function listByTask(
  taskId: number | string,
  options?: { page?: number; perPage?: number; include?: string | null }
): Promise<StatusHistory[]> {
  const id = encodeURIComponent(String(taskId));
  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 20;
  const include = options?.include ?? "changer";

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  if (include) {
    params.set("include", include);
  }

  const ep = `/api/tasks/${id}/status-histories?${params.toString()}`;
  const res = await apiRequest<MaybePaginated<StatusHistory>>("GET", ep);

  if (Array.isArray(res)) {
    return res;
  }

  const data = (res as any)?.data;
  return Array.isArray(data) ? data : [];
}

