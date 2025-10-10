"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Division } from "@/types/division";

type FormState = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  job_title: string;
  is_active: boolean;
  status: string;
  division_id: number | "";
  role_name: string;
};

export default function CreateUserPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    job_title: "",
    is_active: true,
    status: "Aktif",
    division_id: "",
    role_name: "",
  });
  const [roleNames, setRoleNames] = useState<string[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any;
    setForm((s) => ({ ...s, [name]: type === 'checkbox' ? checked : value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        password_confirmation: form.password ? form.password_confirmation : undefined,
        role: form.role_name || undefined, // BE expects role name
        job_title: form.job_title || null,
        is_active: form.is_active,
        status: form.status,
        division_id: form.division_id || null,
      };
      await apiRequest("POST", "/api/users", payload);
      router.push("/dashboard/users");
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat user");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // Prefetch dropdown data; ignore errors (dropdowns optional)
    (async () => {
      try {
        // Try official roles endpoint first
        const rs = await apiRequest<any>("GET", "/api/roles?status=1");
        const items = Array.isArray(rs) ? rs : (rs?.data ?? []);
        const names: string[] = items.map((r: any) => r.name).filter(Boolean);
        setRoleNames(names);
      } catch {
        // Fallback: derive role names from existing users (UserResource includes role?)
        try {
          const us = await apiRequest<any>("GET", "/api/users");
          const list = Array.isArray(us) ? us : (us?.data ?? []);
          const names = Array.from(new Set(list.map((u: any) => u.role).filter(Boolean)));
          setRoleNames(names);
        } catch {}
      }
      try {
        const ds = await apiRequest<Division[] | { data: Division[] }>("GET", "/api/divisions");
        setDivisions(Array.isArray(ds) ? ds : (ds as any).data ?? []);
      } catch {}
    })();
  }, []);

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Create User</h2>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={onChange} required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input type="email" name="email" value={form.email} onChange={onChange} required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input type="password" name="password" value={form.password} onChange={onChange} required className="w-full border rounded-md px-3 py-2" />
        </div>
        {form.password !== undefined && (
          <div>
            <label className="block text-sm mb-1">Confirm Password</label>
            <input type="password" name="password_confirmation" value={form.password_confirmation} onChange={onChange} required className="w-full border rounded-md px-3 py-2" />
          </div>
        )}
        <div>
          <label className="block text-sm mb-1">Role</label>
          <select name="role_name" value={form.role_name} onChange={onChange} required className="w-full border rounded-md px-3 py-2">
            <option value="">Pilih role</option>
            {roleNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <p className="text-xs text-neutral-500 mt-1">Role diperlukan. (akan dikirim sebagai nama role)</p>
        </div>
        <div>
          <label className="block text-sm mb-1">Job Title</label>
          <input name="job_title" value={form.job_title} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Division</label>
          <select name="division_id" value={form.division_id} onChange={onChange} className="w-full border rounded-md px-3 py-2">
            <option value="">(Optional) Pilih division</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
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
          <button type="submit" disabled={submitting} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{submitting ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
