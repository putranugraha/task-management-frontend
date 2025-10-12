"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type DivisionDetail = {
  id: number;
  code: string;
  name: string;
  description: string | null;
};

export default function EditDivisionPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [form, setForm] = useState<DivisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<any>("GET", `/api/divisions/${id}`);
        const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;
        const d = Array.isArray(payload) ? payload[0] : payload;
        if (mounted) {
          setForm({
            id: Number(d.id),
            code: String(d.code ?? ''),
            name: d.name ?? d.division_name ?? d.title ?? d.label ?? '',
            description: d.description ?? '',
          });
        }
      } catch (e: any) {
        setError(e?.message ?? "Gagal memuat data division");
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { mounted = false; };
  }, [id]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((s) => s ? { ...s, [name]: value } as DivisionDetail : s);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        code: form.code || null,
        name: form.name,
        description: form.description || null,
      };
      await apiRequest("PUT", `/api/divisions/${form.id}`, payload);
      router.push("/dashboard/divisions");
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan division");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!form) return <div>Not found</div>;

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Edit Division</h2>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Code</label>
          <input name="code" value={form.code} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={onChange} required className="w-full border rounded-md px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Description</label>
          <textarea name="description" value={form.description ?? ''} onChange={onChange} rows={3} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={saving} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{saving ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

