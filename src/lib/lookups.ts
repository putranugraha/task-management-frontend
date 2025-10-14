import { apiRequest } from "@/lib/api";
import type { Division } from "@/types/division";

export type SimpleRole = { id: number; name: string; status?: string | null };

export async function fetchRolesList(): Promise<SimpleRole[]> {
  const tries = [
    "/api/roles?status=1",
    "/api/roles?status=Aktif",
    "/api/roles",
  ];
  let items: any[] = [];
  for (const path of tries) {
    try {
      const rs = await apiRequest<any>("GET", path);
      const arr = Array.isArray(rs) ? rs : (rs?.data ?? []);
      if (arr && arr.length) { items = arr; break; }
    } catch {}
  }
  return items.map((r: any) => ({ id: r.id, name: r.name, status: r.status ?? null }));
}

export async function fetchDivisionsList(): Promise<Division[]> {
  const tryPaths = [
    "/api/divisions?status=1",
    "/api/divisions?status=Aktif",
    "/api/divisions",
    "/api/division",
  ];
  let items: any[] = [];
  for (const path of tryPaths) {
    try {
      const rs = await apiRequest<any>("GET", path);
      if (Array.isArray(rs)) { items = rs; break; }
      if (rs?.data) {
        if (Array.isArray(rs.data)) { items = rs.data; break; }
        if (Array.isArray(rs.data?.data)) { items = rs.data.data; break; }
      }
      if (Array.isArray(rs?.divisions)) { items = rs.divisions; break; }
      if (Array.isArray(rs?.items)) { items = rs.items; break; }
    } catch {}
  }
  return items.map((d: any) => ({
    id: Number(d.id),
    code: d.code ?? String(d.code ?? ""),
    name: d.name ?? d.division_name ?? d.title ?? d.label ?? String(d.code ?? ""),
    description: d.description ?? null,
    created_at: d.created_at ?? "",
    updated_at: d.updated_at ?? "",
    users_count: typeof d.users_count === 'number' ? d.users_count : undefined,
  }));
}

