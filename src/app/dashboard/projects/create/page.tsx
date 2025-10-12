"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type SimpleUser = { id: number; name: string };

type FormState = {
  name: string;
  client_name: string;
  value_amount: string; // keep as string input, convert on submit
  scope: string;
  objective: string;
  division_owner_id: number | "";
  start_planned: string;
  end_planned: string;
  status: string;
};

const STATUS_OPTIONS = ["Planned", "In Progress", "Completed", "On Hold"] as const;

export default function CreateProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    client_name: "",
    value_amount: "",
    scope: "",
    objective: "",
    division_owner_id: "",
    start_planned: "",
    end_planned: "",
    status: "Planned",
  });
  const [owners, setOwners] = useState<SimpleUser[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        name: form.name,
        client_name: form.client_name,
        value_amount: form.value_amount ? parseFloat(form.value_amount) : 0,
        scope: form.scope || null,
        objective: form.objective || null,
        division_owner_id: form.division_owner_id || null,
        start_planned: form.start_planned || null,
        end_planned: form.end_planned || null,
        status: form.status,
      };
      await apiRequest("POST", "/api/projects", payload);
      router.push("/dashboard/projects");
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat project");
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Create Project</h2>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
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
          <input name="value_amount" value={form.value_amount} onChange={onChange} inputMode="decimal" className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Owner</label>
          <select
            name="division_owner_id"
            value={form.division_owner_id}
            onChange={(e) => setForm((s) => ({ ...s, division_owner_id: e.target.value ? Number(e.target.value) as number : "" }))}
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
          <input type="date" name="start_planned" value={form.start_planned} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">End Planned</label>
          <input type="date" name="end_planned" value={form.end_planned} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm">Status</label>
          <select name="status" value={form.status} onChange={onChange} className="border rounded-md px-2 py-1 text-sm">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Scope</label>
          <textarea name="scope" value={form.scope} onChange={onChange} rows={3} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Objective</label>
          <textarea name="objective" value={form.objective} onChange={onChange} rows={3} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={submitting} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{submitting ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

