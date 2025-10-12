"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type FormState = {
  code: string;
  name: string;
  description: string;
};

export default function CreateDivisionPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ code: "", name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        code: form.code || null,
        name: form.name,
        description: form.description || null,
      };
      await apiRequest("POST", "/api/divisions", payload);
      router.push("/dashboard/divisions");
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat division");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Create Division</h2>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
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
          <textarea name="description" value={form.description} onChange={onChange} rows={3} className="w-full border rounded-md px-3 py-2" />
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={submitting} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{submitting ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}

