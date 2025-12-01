"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { RichTextArea } from "@/components/ui/RichTextArea";

type SimpleUser = { id: number; name: string };

type FormState = {
  name: string;
  client_name: string;
  value_amount: string; // keep as string input, convert on submit
  scope: string;
  objective: string;
  division_owner_id: number | "";
  division_owner_name?: string;
  start_planned: string;
  end_planned: string;
  status: string;
};

// Status default diset internal (hidden from UI)

export default function CreateProjectPage() {
  const { loading: authLoading, allowed } = usePermissionGuard([
    "mengelola project",
  ]);

  if (!authLoading && !allowed) {
    return <Forbidden />;
  }

  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    client_name: "",
    value_amount: "",
    scope: "",
    objective: "",
    division_owner_id: "",
    division_owner_name: "",
    start_planned: "",
    end_planned: "",
    status: "Planned",
  });
  const [owners, setOwners] = useState<SimpleUser[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(true);
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
      setTimeout(() => router.push("/dashboard/projects"), 700);
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat project");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setOwnersLoading(true);
      try {
        const rs = await apiRequest<any>("GET", "/api/users");
        const list = Array.isArray(rs) ? rs : (rs?.data ?? []);
        const normalized: SimpleUser[] = list.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email }));
        if (mounted) setOwners(normalized);
      } catch {}
      if (mounted) setOwnersLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const handleCancel = () => {
    if (submitting) return;
    router.push("/dashboard/projects");
  };

  // Checklist similar to Create User for consistency
  const checklistItems = useMemo(() => {
    return [
      { key: "basic", label: "Isi nama, client, dan nilai proyek", completed: Boolean(form.name && form.client_name && form.value_amount) },
      { key: "timeline", label: "Atur tanggal mulai dan selesai", completed: Boolean(form.start_planned && form.end_planned) },
      { key: "owner", label: "Pilih owner proyek", completed: Boolean(form.division_owner_id) },
      { key: "scope", label: "Lengkapi scope dan objective", completed: Boolean(form.scope && form.objective) },
    ];
  }, [form]);

  const checklistProgress = useMemo(() => {
    const total = checklistItems.length;
    const done = checklistItems.filter((i) => i.completed).length;
    return Math.round((done / total) * 100);
  }, [checklistItems]);

  const selectedOwner = useMemo(() => {
    if (!form.division_owner_id) return null;
    return owners.find((o) => o.id === Number(form.division_owner_id)) ?? null;
  }, [owners, form.division_owner_id]);

  if (authLoading || ownersLoading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-8 w-64 rounded-md" />
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>

        <div className="grid items-stretch gap-8 min-w-0 w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-3xl" />
            <Skeleton className="h-10 w-2/3 rounded-full" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-40 rounded-md" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <div className="flex justify-end gap-2">
              <Skeleton className="h-9 w-20 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            Back to Projects
          </button>
          <h1 className="text-3xl font-semibold text-slate-900">Create Project</h1>
          <p className="max-w-xl text-sm text-slate-500">
            Lengkapi detail proyek agar tim dapat memulai pekerjaan dengan konteks yang jelas.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <div className="grid gap-8 min-w-0 w-full lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <aside className="min-w-0 flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-xl">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="w-full rounded-full bg-emerald-800/30">
                <div className="h-1 rounded-full bg-white/80 transition-all duration-500" style={{ width: `${checklistProgress}%` }} />
              </div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">Preparation Checklist</h2>
            </div>
            <ul className="space-y-3 text-sm leading-relaxed">
              {checklistItems.map((item) => (
                <li key={item.key} className={`flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2 transition-all duration-300 hover:translate-x-1 ${item.completed ? "text-white opacity-100" : "text-white/70 opacity-60"}`}>
                  <CheckCircleIcon className={`h-5 w-5 flex-none ${item.completed ? "text-white" : "text-white/50"}`} />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Tip</p>
            <p className="text-sm leading-relaxed">Pastikan jadwal realistis dan sesuai kapasitas tim.</p>
          </div>
        </aside>

        <form onSubmit={onSubmit} className="flex h-full min-w-0 w-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Project Details</h2>
            <p className="text-xs text-neutral-400">Informasi dasar yang diperlukan untuk membuat proyek baru.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-slate-500">Name</label>
              <input id="name" name="name" value={form.name} onChange={onChange} required className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" placeholder="New Project" />
            </div>
            <div className="space-y-2">
              <label htmlFor="client_name" className="text-sm font-semibold text-slate-500">Client</label>
              <input id="client_name" name="client_name" value={form.client_name} onChange={onChange} required className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" placeholder="PT. Contoh Abadi" />
            </div>
            <div className="space-y-2">
              <label htmlFor="value_amount" className="text-sm font-semibold text-slate-500">Value (IDR)</label>
              <input id="value_amount" name="value_amount" value={form.value_amount} onChange={onChange} inputMode="decimal" className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" placeholder="500000000" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-500">Owner</label>
              {ownersLoading ? (
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300">
                      <span className={selectedOwner ? "text-slate-700" : "text-slate-400"}>{selectedOwner?.name ?? "Pilih owner"}</span>
                      <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[240px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
                    {owners.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-neutral-400">Tidak ada data</div>
                    ) : (
                      owners.map((o) => (
                        <DropdownMenuItem key={o.id} onSelect={() => setForm((s) => ({ ...s, division_owner_id: o.id, division_owner_name: o.name }))} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700">
                          <span>{o.name}</span>
                          {form.division_owner_id === o.id && <Check className="h-4 w-4 text-emerald-500" />}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="start_planned" className="text-sm font-semibold text-slate-500">Start Planned</label>
              <input id="start_planned" type="date" name="start_planned" value={form.start_planned} onChange={onChange} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div className="space-y-2">
              <label htmlFor="end_planned" className="text-sm font-semibold text-slate-500">End Planned</label>
              <input id="end_planned" type="date" name="end_planned" value={form.end_planned} onChange={onChange} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" />
            </div>
          </div>

          {/* Status hidden: default kept as 'Planned' in state/payload */}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2 md:col-span-3">
              <RichTextArea
                id="scope"
                label="Scope"
                placeholder="Deskripsikan cakupan proyek"
                value={form.scope}
                onChange={(val) => setForm((s) => ({ ...s, scope: val }))}
                rows={4}
              />
            </div>
            <div className="space-y-2 md:col-span-3">
              <RichTextArea
                id="objective"
                label="Objective"
                placeholder="Tujuan utama proyek"
                value={form.objective}
                onChange={(val) => setForm((s) => ({ ...s, objective: val }))}
                rows={4}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-400">Semua data terenkripsi dan dikirim melalui koneksi aman.</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleCancel} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300" disabled={submitting}>Cancel</button>
              <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Saving" : "Create Project"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
