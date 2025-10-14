"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Division } from "@/types/division";
import { fetchRolesList, fetchDivisionsList, type SimpleRole } from "@/lib/lookups";

type UserDetail = {
  id: number;
  name: string;
  email: string;
  job_title: string | null;
  is_active: boolean;
  status: string;
  role?: string | null;
  division?: { id: number; name: string } | null;
};

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [form, setForm] = useState<UserDetail | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<SimpleRole[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [roleName, setRoleName] = useState<string>("");
  const [roleId, setRoleId] = useState<number | "">("");
  const [divisionId, setDivisionId] = useState<number | "">("");

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<any>("GET", `/api/users/${id}`);
        // Unwrap Laravel JsonResource shape if present
        const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;
        const u = Array.isArray(payload) ? payload[0] : payload;
        if (mounted) {
          setForm({
            id: u.id,
            name: u.name,
            email: u.email,
            job_title: u.job_title ?? "",
            is_active: Boolean(u.is_active ?? true),
            status: u.status ?? "Aktif",
          });
          // preselect division and role if available
          setDivisionId((u.division?.id as number) ?? "");
          // Prefer explicit 'role' string; otherwise derive from roles array
          const roleFromArray = Array.isArray(u.roles) && u.roles.length ? (typeof u.roles[0] === 'string' ? u.roles[0] : u.roles[0]?.name) : "";
          setRoleName(u.role ?? roleFromArray ?? "");
        }
      } catch (e: any) {
        setError(e?.message ?? "Gagal memuat data user");
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
        const normalized = await fetchRolesList();
        setRoles(normalized);
        if (roleName && !roleId) {
          const found = normalized.find((r) => r.name === roleName);
          if (found) setRoleId(found.id);
        }
      } catch {
        try {
          const us = await apiRequest<any>("GET", "/api/users");
          const list = Array.isArray(us) ? us : (us?.data ?? []);
          const names: string[] = Array.from(
            new Set(
              (list.map((u: any) => u.role)
                .filter((v: any): v is string => typeof v === 'string'))
            )
          );
          setRoles(names.map((n, i): SimpleRole => ({ id: i + 1, name: n })));
        } catch {}
      }
      try {
        const normalizedDivs = await fetchDivisionsList();
        setDivisions(normalizedDivs);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id, roleName]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any;
    setForm((s) => (s ? { ...s, [name]: type === 'checkbox' ? checked : value } : s));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        email: form.email,
        job_title: form.job_title || null,
        is_active: form.is_active,
        status: form.status,
      };
      if (password) payload.password = password;
      if (roleName) payload.role = roleName; // name for BE that expects string
      if (roleId) payload.role_id = roleId; // id for BE that expects id
      payload.division_id = divisionId || null;
      await apiRequest("PUT", `/api/users/${form.id}`, payload);
      router.push("/dashboard/users");
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan user");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!form) return <div>Not found</div>;

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Edit User</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Role</label>
          <select
            value={roleId}
            onChange={(e) => {
              const id = e.target.value ? Number(e.target.value) : "";
              setRoleId(id);
              const found = roles.find((r) => r.id === Number(id));
              setRoleName(found?.name || "");
            }}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">Pilih role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Division</label>
          <select value={divisionId} onChange={(e) => setDivisionId(e.target.value ? Number(e.target.value) : "")} className="w-full border rounded-md px-3 py-2">
            <option value="">(Optional) Pilih division</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input type="email" name="email" value={form.email} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Password (optional)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Job Title</label>
          <input name="job_title" value={form.job_title ?? ""} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" checked={form.is_active} onChange={onChange} /> Active</label>
          <label className="text-sm">Status</label>
          <select name="status" value={form.status} onChange={onChange} className="border rounded-md px-2 py-1 text-sm">
            <option value="Aktif">Aktif</option>
            <option value="Non Aktif">Non Aktif</option>
          </select>
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={saving} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
