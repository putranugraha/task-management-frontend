"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type SimpleUser = { id: number; name: string };

type ProjectDetail = {
  id: number;
  name: string;
  client_name: string;
  value_amount: number | string;
  scope: string | null;
  objective: string | null;
  division_owner_id: number | null;
  start_planned: string | null;
  end_planned: string | null;
  status: string;
};

const STATUS_OPTIONS = ["Planned", "In Progress", "Completed", "On Hold"] as const;

export default function EditProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [form, setForm] = useState<ProjectDetail | null>(null);
  const [owners, setOwners] = useState<SimpleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<any>("GET", `/api/projects/${id}`);
        const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;
        const p = Array.isArray(payload) ? payload[0] : payload;
        if (mounted) {
          setForm({
            id: Number(p.id),
            name: p.name,
            client_name: p.client_name ?? p.client ?? '',
            value_amount: typeof p.value_amount === 'string' ? p.value_amount : Number(p.value_amount ?? 0),
            scope: p.scope ?? '',
            objective: p.objective ?? '',
            division_owner_id: (p.division_owner_id != null) ? Number(p.division_owner_id) : (p.division_owner?.id ? Number(p.division_owner.id) : null),
            start_planned: p.start_planned ?? null,
            end_planned: p.end_planned ?? null,
            status: p.status ?? 'Planned',
          });
        }
      } catch (e: any) {
        setError(e?.message ?? "Gagal memuat data project");
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
        const rs = await apiRequest<any>("GET", "/api/users");
        const list = Array.isArray(rs) ? rs : (rs?.data ?? []);
        const normalized: SimpleUser[] = list.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email }));
        setOwners(normalized);
      } catch {}
    })();
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((s) => s ? { ...s, [name]: value } as ProjectDetail : s);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        client_name: form.client_name,
        value_amount: typeof form.value_amount === 'string' ? (form.value_amount ? parseFloat(form.value_amount) : 0) : form.value_amount,
        scope: form.scope || null,
        objective: form.objective || null,
        division_owner_id: form.division_owner_id || null,
        start_planned: form.start_planned || null,
        end_planned: form.end_planned || null,
        status: form.status,
      };
      await apiRequest("PUT", `/api/projects/${form.id}`, payload);
      router.push("/dashboard/projects");
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan project");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!form) return <div>Not found</div>;

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Edit Project</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={onChange} required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Client Name</label>
          <input name="client_name" value={form.client_name} onChange={onChange} required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Value Amount (IDR)</label>
          <input name="value_amount" value={String(form.value_amount ?? '')} onChange={onChange} inputMode="decimal" className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Owner</label>
          <select
            name="division_owner_id"
            value={form.division_owner_id ?? ''}
            onChange={(e) => setForm((s) => s ? { ...s, division_owner_id: e.target.value ? Number(e.target.value) : null } : s)}
            className="w-full border rounded-md px-3 py-2"
          >
            <option value="">(Optional) Pilih owner</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Start Planned</label>
          <input type="date" name="start_planned" value={form.start_planned ?? ''} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">End Planned</label>
          <input type="date" name="end_planned" value={form.end_planned ?? ''} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm">Status</label>
          <select name="status" value={form.status} onChange={onChange} className="border rounded-md px-2 py-1 text-sm">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Scope</label>
          <textarea name="scope" value={form.scope ?? ''} onChange={onChange} rows={3} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Objective</label>
          <textarea name="objective" value={form.objective ?? ''} onChange={onChange} rows={3} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={saving} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

