"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Permission } from "@/types/permission";

type RoleDetail = {
  id: number;
  name: string;
  status?: string | null;
  permissions: string[]; // names
};

export default function EditRolePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [form, setForm] = useState<RoleDetail | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<any>("GET", `/api/roles/${id}`);
        const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;
        const r = Array.isArray(payload) ? payload[0] : payload;
        if (mounted) {
          setForm({
            id: r.id,
            name: r.name,
            status: r.status ?? 'Aktif',
            permissions: Array.isArray(r.permissions) ? r.permissions.map((p: any) => (typeof p === 'string' ? p : p?.name)).filter(Boolean) : [],
          });
        }
      } catch (e: any) {
        setError(e?.message ?? "Gagal memuat data role");
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<Permission[] | { data: Permission[] }>("GET", "/api/permissions");
        const list = Array.isArray(res) ? res : (res as any).data ?? [];
        setPermissions(list);
      } catch {}
    })();
  }, []);

  const onTogglePermission = (name: string) => {
    setForm((s) => s ? ({
      ...s,
      permissions: s.permissions.includes(name)
        ? s.permissions.filter((n) => n !== name)
        : [...s.permissions, name],
    }) : s);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      // Map selected permission names to IDs when possible for BE compatibility
      const nameToId = new Map(permissions.map((p) => [p.name, p.id] as const));
      const permission_ids = form.permissions.map((n) => nameToId.get(n)).filter((v): v is number => typeof v === 'number');
      const payload: Record<string, any> = {
        name: form.name,
        status: form.status,
        permissions: form.permissions, // send names
        permission_ids, // and also send ids when resolvable
      };
      await apiRequest("PUT", `/api/roles/${form.id}`, payload);
      router.push("/dashboard/roles");
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan role");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!form) return <div>Not found</div>;

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Edit Role</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm">Status</label>
          <select value={form.status ?? 'Aktif'} onChange={(e) => setForm({ ...form!, status: e.target.value })} className="border rounded-md px-2 py-1 text-sm">
            <option value="Aktif">Aktif</option>
            <option value="Non Aktif">Non Aktif</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Permissions</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto p-2 border rounded-md">
            {permissions.map((p) => {
              const checked = form.permissions.includes(p.name);
              return (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={checked} onChange={() => onTogglePermission(p.name)} />
                  <span>{p.name}</span>
                </label>
              );
            })}
            {permissions.length === 0 && (
              <div className="text-sm text-neutral-500">No permissions found</div>
            )}
          </div>
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={saving} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
