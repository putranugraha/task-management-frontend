"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Permission } from "@/types/permission";

type FormState = {
  name: string;
  status: string;
  permissions: string[]; // store permission names for compatibility
};

export default function CreateRolePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    status: "Aktif",
    permissions: [],
  });
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<Permission[] | { data: Permission[] }>("GET", "/api/permissions");
        const list = Array.isArray(res) ? res : (res as any).data ?? [];
        setPermissions(list);
      } catch (e) {
        // ignore; still allow role creation without preloaded permissions
      }
    })();
  }, []);

  const onTogglePermission = (name: string) => {
    setForm((s) => ({
      ...s,
      permissions: s.permissions.includes(name)
        ? s.permissions.filter((n) => n !== name)
        : [...s.permissions, name],
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
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
      await apiRequest("POST", "/api/roles", payload);
      router.push("/dashboard/roles");
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat role");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Create Role</h2>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm">Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border rounded-md px-2 py-1 text-sm">
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
          <p className="text-xs text-neutral-500 mt-1">Centang permission yang diberikan ke role.</p>
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={submitting} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{submitting ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
