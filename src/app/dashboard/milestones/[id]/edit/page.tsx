"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import { fetchProjectsList } from "@/lib/lookups";
import { MILESTONE_STATUS_OPTIONS } from "@/lib/api/milestones";
import { ChevronLeft, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { DetailMainCard } from "@/components/layout/DetailCards";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type MilestoneDetail = {
  id: number;
  project_id: number | "";
  name: string;
  due_planned: string | null;
  due_actual: string | null;
  status: string;
};

export default function EditMilestonePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [form, setForm] = useState<MilestoneDetail | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<any>("GET", `/api/milestones/${id}`);
        const payload = (data && typeof data === 'object' && 'data' in data) ? (data as any).data : data;
        const m = Array.isArray(payload) ? payload[0] : payload;
        if (mounted && m) {
          const status = MILESTONE_STATUS_OPTIONS.includes(m.status as any) ? m.status : 'Planned';
          setForm({
            id: m.id,
            project_id: (m.project?.id as number) ?? (m.project_id ?? ""),
            name: m.name,
            due_planned: m.due_planned ?? "",
            due_actual: m.due_actual ?? "",
            status,
          });
        }
      } catch (e: any) {
        const msg = e?.message ?? "Gagal memuat data milestone";
        setError(msg);
        showToast({
          variant: "error",
          title: "Gagal memuat milestone",
          description: msg,
        });
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { (mounted = false); };
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchProjectsList();
        setProjects(list);
      } catch {}
    })();
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => s ? ({
      ...s,
      [name]: name === 'project_id' ? (value ? Number(value) : "") : value,
    }) : s);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {
        project_id: form.project_id || null,
        name: form.name,
        due_planned: form.due_planned || null,
        due_actual: form.due_actual || null,
        status: form.status,
      };
      await apiRequest("PUT", `/api/milestones/${form.id}`, payload);
      showToast({
        variant: "success",
        title: "Perubahan disimpan",
        description: `Milestone "${form.name}" berhasil diperbarui.`,
      });
      router.push("/dashboard/milestones");
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menyimpan milestone";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal menyimpan milestone",
        description: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (saving) return;
    router.push("/dashboard/milestones");
  };

  // Keep hooks order stable across renders (even when `form` is null)
  const checklistItems = useMemo(() => {
    const f = form ?? { name: '', due_planned: null as string | null, due_actual: null as string | null, status: '' };
    return [
      { key: 'name', label: 'Perbarui nama milestone', completed: Boolean(f.name) },
      { key: 'due', label: 'Periksa tanggal (planned/actual)', completed: Boolean(f.due_planned || f.due_actual) },
      { key: 'status', label: 'Set status milestone', completed: Boolean(f.status) },
    ];
  }, [form]);

  const checklistProgress = useMemo(() => {
    const total = checklistItems.length;
    const done = checklistItems.filter((i) => i.completed).length;
    return Math.round((done / total) * 100);
  }, [checklistItems]);

  if (error) return <div className="text-red-600">{error}</div>;

  if (!form) {
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
              Back to Milestones
            </button>
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-4 w-80 rounded-md" />
            </div>
          </div>
        </div>

        <DetailMainCard>
          <div className="grid items-stretch gap-8 min-w-0 w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <aside className="min-w-0 self-stretch flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="w-full rounded-full bg-emerald-800/30">
                    <div className="h-1 w-1/2 rounded-full bg-white/70 animate-pulse" />
                  </div>
                  <Skeleton className="h-5 w-40 rounded-md bg-white/20" />
                </div>
                <ul className="space-y-3 text-sm leading-relaxed">
                  {[1, 2, 3].map((i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2"
                    >
                      <div className="h-5 w-5 flex-none rounded-full bg-white/30 animate-pulse" />
                      <div className="h-3 w-3/4 rounded-md bg-white/30 animate-pulse" />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
                <Skeleton className="mb-2 h-3 w-16 rounded bg-white/20" />
                <Skeleton className="h-3 w-2/3 rounded bg-white/20" />
              </div>
            </aside>

            <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-3 w-64 rounded" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded" />
                  <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-32 rounded-full" />
              </div>
            </div>
          </div>
        </DetailMainCard>
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
            Back to Milestones
          </button>
          <h1 className="text-3xl font-semibold text-slate-900">Edit Milestone</h1>
          <p className="max-w-xl text-sm text-slate-500">Perbarui informasi milestone. Pastikan tanggal dan status sesuai.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <DetailMainCard>
      <div className="grid items-stretch gap-8 min-w-0 w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <aside className="min-w-0 self-stretch flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-xl">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="w-full rounded-full bg-emerald-800/30">
                <div className="h-1 rounded-full bg-white/80 transition-all duration-500" style={{ width: `${checklistProgress}%` }} />
              </div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">Milestone Setup</h2>
            </div>
            <ul className="space-y-3 text-sm leading-relaxed">
              {checklistItems.map((item) => (
                <li
                  key={item.key}
                  className={`flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2 transition-all duration-300 hover:translate-x-1 ${item.completed ? 'text-white opacity-100' : 'text-white/70 opacity-60'}`}
                >
                  <CheckCircleIcon className={`h-5 w-5 flex-none ${item.completed ? 'text-white' : 'text-white/50'}`} />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Tip</p>
            <p className="text-sm leading-relaxed">"Due Actual" sebaiknya diisi ketika milestone benar-benar selesai.</p>
          </div>
        </aside>

        <form onSubmit={onSubmit} className="min-w-0 self-stretch flex h-full w-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Milestone Details</h2>
            <p className="text-xs text-neutral-400">Perbarui field yang diperlukan lalu simpan perubahan.</p>
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
                placeholder="Milestone name"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="project_id" className="text-sm font-semibold text-slate-500">Project</label>
              <select
                id="project_id"
                name="project_id"
                value={form.project_id}
                onChange={onChange}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
              >
                <option value="">(Optional) Pilih project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="due_planned" className="text-sm font-semibold text-slate-500">Due Planned</label>
              <input
                id="due_planned"
                type="date"
                name="due_planned"
                value={form.due_planned ?? ''}
                onChange={onChange}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="due_actual" className="text-sm font-semibold text-slate-500">Due Actual</label>
              <input
                id="due_actual"
                type="date"
                name="due_actual"
                value={form.due_actual ?? ''}
                onChange={onChange}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-500">Status</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                >
                  <span className={form.status ? "text-slate-700" : "text-slate-400"}>
                    {form.status || "Pilih status"}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[220px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
              >
                {MILESTONE_STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt}
                    onSelect={() =>
                      setForm((s) => (s ? { ...s, status: opt } : s))
                    }
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                  >
                    <span>{opt}</span>
                    {form.status === opt && (
                      <Check className="h-4 w-4 text-emerald-500" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-400">Perubahan akan tersimpan aman melalui koneksi terenkripsi.</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
      </DetailMainCard>
    </div>
  );
}
