"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Project } from "@/types/project";
import { fetchProjectsList } from "@/lib/lookups";
import { Check, ChevronLeft, ChevronsUpDown, Loader2 } from "lucide-react";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { DetailMainCard } from "@/components/layout/DetailCards";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type FormState = {
  project_id: number | "";
  name: string;
  due_planned: string;
};

function CreateMilestonePageContent() {
  const router = useRouter();
  const todayLocal = (() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  })();
  const [form, setForm] = useState<FormState>({
    project_id: "",
    name: "",
    due_planned: "",
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const { showToast } = useToast();

  const selectedProject = useMemo(() => {
    if (!form.project_id) return null;
    return projects.find((p) => Number(p.id) === Number(form.project_id)) ?? null;
  }, [form.project_id, projects]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => ({
      ...s,
      [name]: value,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (!form.project_id) {
        const msg = "Project wajib dipilih";
        setError(msg);
        showToast({
          variant: "error",
          title: "Validasi gagal",
          description: msg,
        });
        setSubmitting(false);
        return;
      }
      const payload: Record<string, any> = {
        project_id: form.project_id,
        name: form.name,
        // Explicitly send default status so backend validation passes
        status: "Planned",
        due_planned: form.due_planned || null,
      };
      await apiRequest("POST", "/api/milestones", payload);
      setSuccessMessage("Milestone berhasil ditambahkan.");
      showToast({
        variant: "success",
        title: "Milestone dibuat",
        description: `Milestone "${form.name}" berhasil ditambahkan.`,
      });
      setTimeout(() => router.push("/dashboard/milestones"), 900);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal membuat milestone";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal membuat milestone",
        description: msg,
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const list = await fetchProjectsList();
        if (mounted) setProjects(list);
      } catch {
      } finally {
        if (mounted) setLookupsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleCancel = () => {
    if (submitting) return;
    router.push("/dashboard/milestones");
  };

  const checklistItems = useMemo(
    () => [
      { key: "name", label: "Isi nama milestone dengan benar", completed: Boolean(form.name) },
      { key: "project", label: "Pilih project", completed: Boolean(form.project_id) },
      { key: "due", label: "Set Due Planned (opsional)", completed: Boolean(form.due_planned) },
    ],
    [form]
  );

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
            Back to Milestones
          </button>
          <h1 className="text-3xl font-semibold text-slate-900">Create Milestone</h1>
          <p className="max-w-xl text-sm text-slate-500">
            Lengkapi informasi milestone. Status tidak perlu diisi (default Planned).
          </p>
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
                  <div
                    className="h-1 rounded-full bg-white/80 transition-all duration-500"
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
                <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">
                  Milestone Setup
                </h2>
              </div>
              <ul className="space-y-3 text-sm leading-relaxed">
                {checklistItems.map((item) => (
                  <li
                    key={item.key}
                    className={`flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2 transition-all duration-300 hover:translate-x-1 ${
                      item.completed ? "text-white opacity-100" : "text-white/70 opacity-60"
                    }`}
                  >
                    <CheckCircleIcon
                      className={`h-5 w-5 flex-none ${item.completed ? "text-white" : "text-white/50"}`}
                    />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Tip</p>
              <p className="text-sm leading-relaxed">
                "Due Actual" akan terisi otomatis saat milestone ditandai Completed.
              </p>
            </div>
          </aside>

          <form
            onSubmit={onSubmit}
            className="min-w-0 self-stretch flex h-full w-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm"
          >
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Milestone Details
              </h2>
              <p className="text-xs text-neutral-400">
                Informasi dasar yang diperlukan untuk menambahkan milestone baru.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-semibold text-slate-500">
                  Name
                </label>
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
                <label className="text-sm font-semibold text-slate-500">
                  Project
                </label>
                {lookupsLoading ? (
                  <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/60" />
                ) : projects.length === 0 ? (
                  <div className="flex h-11 w-full items-center rounded-xl border border-slate-200 bg-neutral-50 px-4 text-sm font-medium text-slate-400 shadow-inner">
                    Tidak ada project
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                        aria-label="Pilih project"
                      >
                        <span className={selectedProject ? "text-slate-700" : "text-slate-400"}>
                          {selectedProject?.name ?? "Pilih project"}
                        </span>
                        <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="min-w-[260px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
                    >
                      {projects.map((p) => (
                        <DropdownMenuItem
                          key={p.id}
                          onSelect={() => setForm((s) => ({ ...s, project_id: Number(p.id) }))}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                        >
                          <span>{p.name}</span>
                          {Number(form.project_id) === Number(p.id) && (
                            <Check className="h-4 w-4 text-emerald-500" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="due_planned" className="text-sm font-semibold text-slate-500">
                  Due Planned
                </label>
                <input
                  id="due_planned"
                  type="date"
                  name="due_planned"
                  value={form.due_planned}
                  onChange={onChange}
                  min={todayLocal}
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="due_actual" className="text-sm font-semibold text-slate-500">
                  Due Actual
                </label>
                <input
                  id="due_actual"
                  type="date"
                  name="due_actual"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-neutral-50 px-4 text-sm font-medium text-neutral-500 shadow-inner"
                  disabled
                  readOnly
                  placeholder="Auto-filled when milestone is completed"
                />
                <p className="text-[11px] text-slate-400">Bisa dikosongkan, akan terisi saat Completed.</p>
              </div>
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
                  {submitting ? "Saving" : "Create Milestone"}
                </button>
              </div>
            </div>

            {successMessage && (
              <p className="mt-3 text-sm font-medium text-emerald-600">{successMessage}</p>
            )}
          </form>
        </div>
      </DetailMainCard>
    </div>
  );
}

export default function CreateMilestonePage() {
  const { loading, allowed } = usePermissionGuard(["membuat project"]);

  if (!loading && !allowed) {
    return <Forbidden />;
  }

  if (loading) {
    return null;
  }

  return <CreateMilestonePageContent />;
}
