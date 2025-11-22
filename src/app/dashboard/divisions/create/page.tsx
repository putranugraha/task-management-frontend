"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { ChevronLeft, Loader2 } from "lucide-react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { DetailMainCard, DetailTwoColumnGrid } from "@/components/layout/DetailCards";

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const payload: Record<string, any> = {
        code: form.code || null,
        name: form.name,
        description: form.description || null,
      };
      await apiRequest("POST", "/api/divisions", payload);
      setSuccessMessage("Division berhasil ditambahkan.");
      setTimeout(() => router.push("/dashboard/divisions"), 900);
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat division");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    router.push("/dashboard/divisions");
  };

  const checklistItems = useMemo(() => {
    return [
      { key: "name", label: "Isi nama division dengan benar", completed: Boolean(form.name) },
      { key: "code", label: "Tambahkan code (opsional) untuk identifikasi", completed: Boolean(form.code) },
      { key: "desc", label: "Tuliskan deskripsi singkat (opsional)", completed: Boolean(form.description) },
    ];
  }, [form]);

  const checklistProgress = useMemo(() => {
    const total = checklistItems.length;
    const done = checklistItems.filter((i) => i.completed).length;
    return Math.round((done / total) * 100);
  }, [checklistItems]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleCancel}
            className="group inline-flex items-center gap-2 text-sm font-medium text-[#00674F] transition hover:text-[#008061]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00674F]/10 text-[#00674F] transition group-hover:bg-[#008061]/20 group-hover:text-[#008061]">
              <ChevronLeft className="h-4 w-4" />
            </span>
            Back to Divisions
          </button>
          <h1 className="text-3xl font-semibold text-slate-900">Create Division</h1>
          <p className="max-w-xl text-sm text-slate-500">
            Lengkapi informasi divisi dan pastikan penamaan konsisten dengan struktur organisasi.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <DetailMainCard>
        <DetailTwoColumnGrid className="min-w-0 w-full">
        <aside className="min-w-0 flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-xl">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="w-full rounded-full bg-emerald-800/30">
                <div
                  className="h-1 rounded-full bg-white/80 transition-all duration-500"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">Division Setup</h2>
            </div>
            <ul className="space-y-3 text-sm leading-relaxed">
              {checklistItems.map((item) => (
                <li
                  key={item.key}
                  className={`flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2 transition-all duration-300 hover:translate-x-1 ${item.completed ? "text-white opacity-100" : "text-white/70 opacity-60"}`}
                >
                  <CheckCircleIcon className={`h-5 w-5 flex-none ${item.completed ? "text-white" : "text-white/50"}`} />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Tip</p>
            <p className="text-sm leading-relaxed">Gunakan kode singkat (misal: FIN, HR) untuk memudahkan referensi lintas sistem.</p>
          </div>
        </aside>

        <form
          onSubmit={onSubmit}
          className="flex h-full min-w-0 w-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm"
        >
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Division Details</h2>
            <p className="text-xs text-neutral-400">Informasi dasar yang diperlukan untuk menambahkan divisi baru.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-slate-500">Name</label>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={onChange}
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                placeholder="Finance"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-semibold text-slate-500">Code</label>
              <input
                id="code"
                name="code"
                value={form.code}
                onChange={onChange}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                placeholder="FIN"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="description" className="text-sm font-semibold text-slate-500">Description</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={onChange}
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
              placeholder="Deskripsi singkat mengenai fungsi dan tanggung jawab divisi."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-400">
              Semua data terenkripsi dan dikirim melalui koneksi aman.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Saving" : "Create Division"}
              </button>
            </div>
          </div>

          {successMessage && (
            <p className="mt-3 text-sm font-medium text-emerald-600">{successMessage}</p>
          )}
        </form>
        </DetailTwoColumnGrid>
      </DetailMainCard>
    </div>
  );
}
