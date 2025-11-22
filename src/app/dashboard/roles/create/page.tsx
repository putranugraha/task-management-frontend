"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Permission } from "@/types/permission";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Loader2, Check, ListChecks, ChevronsUpDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { DetailMainCard, DetailTwoColumnGrid } from "@/components/layout/DetailCards";

type FormState = {
  name: string;
  status: string;
  permissions: string[]; // store permission names for compatibility
};

export default function CreateRolePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    name: "",
    status: "Aktif",
    permissions: [],
  });
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<Permission[] | { data: Permission[] }>("GET", "/api/permissions");
        const list = Array.isArray(res) ? res : (res as any).data ?? [];
        setPermissions(list);
      } catch {}
      setLookupsLoading(false);
    })();
  }, []);

  const onTogglePermission = (name: string) => {
    setForm((s) => ({
      ...s,
      permissions: s.permissions.includes(name)
        ? s.permissions.filter((n) => n !== name)
        : [...s.permissions, name],
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const nameToId = new Map(permissions.map((p) => [p.name, p.id] as const));
      const permission_ids = form.permissions.map((n) => nameToId.get(n)).filter((v): v is number => typeof v === 'number');
      const payload: Record<string, any> = {
        name: form.name,
        status: form.status,
        permissions: form.permissions,
        permission_ids,
      };
      await apiRequest("POST", "/api/roles", payload);
      setSuccessMessage("Role berhasil dibuat.");
      setTimeout(() => router.push("/dashboard/roles"), 900);
    } catch (e: any) {
      setError(e?.message ?? "Gagal membuat role");
    } finally {
      setSubmitting(false);
    }
  };

  const checklistItems = useMemo(() => ([
    {
      key: "name",
      label: "Isi nama role dengan jelas",
      completed: Boolean(form.name.trim()),
    },
    {
      key: "status",
      label: "Pilih status role (Aktif/Non Aktif)",
      completed: Boolean(form.status),
    },
    {
      key: "permissions",
      label: "Pilih minimal 1 permission",
      completed: form.permissions.length > 0,
    },
  ]), [form]);

  const checklistProgress = useMemo(() => {
    const total = checklistItems.length;
    const done = checklistItems.filter((i) => i.completed).length;
    return Math.round((done / total) * 100);
  }, [checklistItems]);

  const handleCancel = () => {
    if (submitting) return;
    router.push("/dashboard/roles");
  };

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
            Back to Roles
          </button>
          <h1 className="text-3xl font-semibold text-slate-900">Create Role</h1>
          <p className="max-w-xl text-sm text-slate-500">Definisikan role, status, dan permissions yang diperlukan.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{error}</div>
      )}

      <DetailMainCard>
        <DetailTwoColumnGrid>
        {/* Sidebar checklist */}
        <aside className="min-w-0 flex flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-xl">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="w-full rounded-full bg-emerald-800/30">
                <div className="h-1 rounded-full bg-white/80 transition-all duration-500" style={{ width: `${checklistProgress}%` }} />
              </div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">Role Checklist</h2>
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
            <p className="text-sm leading-relaxed">Buat nama role singkat dan jelas, misalnya "Manager" atau "Finance Admin".</p>
          </div>
        </aside>

        {/* Form */}
        <form onSubmit={onSubmit} className="min-w-0 flex w-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Role Details</h2>
            <p className="text-xs text-neutral-400">Informasi dasar role dan pengaturan akses.</p>
          </div>

          <div className="min-w-0 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-slate-500">Name</label>
              <input
                id="name"
                name="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                placeholder="Admin"
                autoComplete="off"
              />
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
                  {["Aktif", "Non Aktif"].map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onSelect={() => setForm((s) => ({ ...s, status: opt }))}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                    >
                      <span>{opt}</span>
                      {form.status === opt && <Check className="h-4 w-4 text-emerald-500" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-500">Permissions</label>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              {lookupsLoading ? (
                <div className="min-w-0 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-xl bg-neutral-200/60" />
                  ))}
                </div>
              ) : permissions.length === 0 ? (
                <div className="px-2 py-8 text-center text-sm text-neutral-400">No permissions found</div>
              ) : (
                <div className="min-w-0 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {permissions.map((p) => {
                    const checked = form.permissions.includes(p.name);
                    return (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => onTogglePermission(p.name)}
                        className={`group inline-flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all duration-200 ${checked ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_rgba(16,185,129,0.25)]" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"}`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <ListChecks className={`h-4 w-4 ${checked ? "text-emerald-500" : "text-slate-400"}`} />
                          <span className="truncate max-w-[260px] text-left">{p.name}</span>
                        </span>
                        <span className={`grid h-5 w-5 place-items-center rounded-full border transition ${checked ? "border-emerald-300 bg-emerald-500 text-white" : "border-slate-300 text-transparent"}`}>
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-xs text-slate-400">Klik untuk memilih/meniadakan permission. Gunakan kombinasi yang tepat.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-400">Semua perubahan akan tercatat untuk audit.</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Saving" : "Create Role"}
              </button>
            </div>
          </div>
          {successMessage && (
            <p className="mt-3 text-sm font-medium text-emerald-600">✔ {successMessage}</p>
          )}
        </form>
        </DetailTwoColumnGrid>
      </DetailMainCard>
    </div>
  );
}
