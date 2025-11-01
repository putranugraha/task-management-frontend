"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import type { Role } from "@/types/role";
import type { Column } from "./columns";
import { useRoleColumns, type RoleRow } from "./columns";
import DataTable from "../users/data-table";

type MaybePaginated<T> = T[] | { data: T[] } | { data: T[]; meta?: unknown };

export default function RolesPage() {
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<MaybePaginated<Role>>("GET", "/api/roles");
      const list = Array.isArray(res) ? res : (res as any).data ?? [];
      const mapped: RoleRow[] = list.map((r: any) => {
        // Derive status from multiple common fields
        const rawStatus = r.status ?? r.is_active ?? r.active ?? r.enabled;
        const status = typeof rawStatus === 'string'
          ? rawStatus
          : (rawStatus === true || rawStatus === 1 || rawStatus === '1')
            ? 'Aktif'
            : (rawStatus === false || rawStatus === 0 || rawStatus === '0')
              ? 'Non Aktif'
              : 'Aktif'; // default to Aktif if BE doesn't provide any status field

        // Normalize permissions from various shapes
        let permNames: string[] = [];
        const perms = r.permissions ?? r.permission_names ?? r.perms;
        if (Array.isArray(perms)) {
          permNames = perms.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
        } else if (perms && Array.isArray(perms.data)) {
          permNames = perms.data.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
        } else if (typeof perms === 'string') {
          permNames = perms.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        const permissions_count = typeof r.permissions_count === 'number'
          ? r.permissions_count
          : (Array.isArray(permNames) ? permNames.length : undefined);

        return {
          id: r.id,
          name: r.name,
          status,
          permissions: permNames,
          permissions_count,
          created_at: r.created_at,
        } as RoleRow;
      });
      setRows(mapped);

      // Hydrate permissions per role if index response didn't include them
      const needDetails = mapped.filter((m) => !m.permissions || m.permissions.length === 0);
      if (needDetails.length > 0) {
        const results = await Promise.allSettled(
          needDetails.map((m) => apiRequest<any>("GET", `/api/roles/${m.id}`))
        );
        const byId: Record<number, string[]> = {};
        results.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            const data = res.value && typeof res.value === 'object' && 'data' in res.value ? (res.value as any).data : res.value;
            const r = Array.isArray(data) ? data[0] : data;
            let permNames: string[] = [];
            const perms = r?.permissions ?? r?.permission_names ?? r?.perms;
            if (Array.isArray(perms)) {
              permNames = perms.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
            } else if (perms && Array.isArray(perms.data)) {
              permNames = perms.data.map((p: any) => typeof p === 'string' ? p : p?.name).filter(Boolean);
            } else if (typeof perms === 'string') {
              permNames = perms.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
            const id = needDetails[idx].id;
            byId[id] = permNames;
          }
        });
        if (Object.keys(byId).length > 0) {
          setRows((prev) => prev.map((row) => byId[row.id] ? { ...row, permissions: byId[row.id], permissions_count: byId[row.id].length } : row));
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load roles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const handleDelete = async (row: RoleRow) => {
    const ok = confirm(`Hapus role ${row.name}?`);
    if (!ok) return;
    try {
      await apiRequest("DELETE", `/api/roles/${row.id}`);
      await fetchRoles();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menghapus role");
    }
  };

  const columns = useRoleColumns(handleDelete) as unknown as Column<RoleRow>[];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold">Roles</h2>
        <Link href="/dashboard/roles/create" className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Create Role</Link>
      </div>
      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}
      <DataTable columns={columns as any} data={rows} loading={loading} />
    </div>
  );
}
