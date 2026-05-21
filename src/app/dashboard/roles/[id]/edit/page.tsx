"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Permission } from "@/types/permission";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Loader2, Check, ListChecks, ChevronsUpDown } from "lucide-react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DetailMainCard, DetailTwoColumnGrid } from "@/components/layout/DetailCards";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/auth-context";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";

type RoleDetail = {
  id: number;
  name: string;
  status: string;
  permissions: string[];
};

function EditRolePageContent() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const { showToast } = useToast();
  const { refreshProfile } = useAuth();

  const [form, setForm] = useState<RoleDetail | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiRequest<any>("GET", `/api/roles/${id}`);
        const payload = data && typeof data === "object" && "data" in data ? (data as any).data : data;
        const r = Array.isArray(payload) ? payload[0] : payload;
        if (mounted && r) {
          setForm({
            id: Number(r.id),
            name: r.name ?? "",
            status: r.status ?? "Aktif",
            permissions: Array.isArray(r.permissions)
              ? r.permissions
                  .map((p: any) => (typeof p === "string" ? p : p?.name))
                  .filter(Boolean)
              : [],
          });
        }
      } catch (e: any) {
        setError(e?.message ?? "Gagal memuat data role");
      } finally {
        setLoading(false);
      }
    }

    if (id) run();
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<Permission[] | { data: Permission[] }>("GET", "/api/permissions");
        const list = Array.isArray(res) ? res : (res as any).data ?? [];
        setPermissions(list);
      } catch {
      } finally {
        setLookupsLoading(false);
      }
    })();
  }, []);

  const onTogglePermission = (name: string) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            permissions: prev.permissions.includes(name)
              ? prev.permissions.filter((n) => n !== name)
              : [...prev.permissions, name],
          }
        : prev
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const nameToId = new Map(permissions.map((p) => [p.name, p.id] as const));
      const permission_ids = form.permissions
        .map((n) => nameToId.get(n))
        .filter((v): v is number => typeof v === "number");

      const payload: Record<string, any> = {
        name: form.name,
        status: form.status,
        permissions: form.permissions,
        permission_ids,
      };

      await apiRequest("PUT", `/api/roles/${form.id}`, payload);
      await refreshProfile();
      const okMsg = "Perubahan role berhasil disimpan.";
      setSuccessMessage(okMsg);
      showToast({
        variant: "success",
        title: "Role berhasil diperbarui",
        description: okMsg,
      });
      setTimeout(() => router.push("/dashboard/roles"), 900);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menyimpan role";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal menyimpan role",
        description: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  const checklistItems = useMemo(
    () => [
      {
        key: "name",
        label: "Perbarui nama role jika perlu",
        completed: Boolean(form?.name?.trim()),
      },
      {
        key: "status",
        label: "Pastikan status role sesuai",
        completed: Boolean(form?.status),
      },
      {
        key: "permissions",
        label: "Tinjau dan sesuaikan permissions",
        completed: Boolean(form && form.permissions.length > 0),
      },
    ],
    [form]
  );

  const checklistProgress = useMemo(() => {
    const total = checklistItems.length;
    const done = checklistItems.filter((i) => i.completed).length;
    return Math.round((done / Math.max(1, total)) * 100);
  }, [checklistItems]);

  const handleCancel = () => {
    if (saving) return;
    router.push("/dashboard/roles");
  };

  if (loading || !form) {
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
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-4 w-80 rounded-md" />
            </div>
          </div>
        </div>

        <DetailMainCard>
          <DetailTwoColumnGrid>
            <aside className="min-w-0 flex flex-col gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white">
              <div className="space-y-3">
                <div className="w-full rounded-full bg-emerald-800/30">
                  <div className="h-1 w-1/2 rounded-full bg-white/70 animate-pulse" />
                </div>
                <div className="h-5 w-40 rounded-md bg-white/20" />
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
            </aside>

            <div className="min-w-0 flex w-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20 rounded" />
                    <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
                  </div>
                ))}
              </div>
            </div>
          </DetailTwoColumnGrid>
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
            Back to Roles
          </button>
          <h1 className="text-3xl font-semibold text-slate-900">Edit Role</h1>
          <p className="max-w-xl text-sm text-slate-500">
            Perbarui nama, status, dan permissions role.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <DetailMainCard>
        <DetailTwoColumnGrid>
          <aside className="min-w-0 flex flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-xl">
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="w-full rounded-full bg-emerald-800/30">
                  <div
                    className="h-1 rounded-full bg-white/80 transition-all duration-500"
                    style={{ width: `${checklistProgress}%` }}
                  />
                </div>
                <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">
                  Role Checklist
                </h2>
              </div>
              <ul className="space-y-3 text-sm leading-relaxed">
                {checklistItems.map((item) => (
                  <li
                    key={item.key}
                    className={`flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2 transition-all duration-300 hover:translate-x-1 ${
                      item.completed
                        ? "text-white opacity-100"
                        : "text-white/70 opacity-60"
                    }`}
                  >
                    <CheckCircleIcon
                      className={`h-5 w-5 flex-none ${
                        item.completed ? "text-white" : "text-white/50"
                      }`}
                    />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">
                Tip
              </p>
              <p className="text-sm leading-relaxed">
                Pastikan role hanya memiliki permissions yang diperlukan.
              </p>
            </div>
          </aside>

          <form
            onSubmit={onSubmit}
            className="min-w-0 flex w-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm"
          >
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Role Details
              </h2>
              <p className="text-xs text-neutral-400">
                Perbarui atribut role dan hak akses.
              </p>
            </div>

            <div className="min-w-0 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-semibold text-slate-500">
                  Name
                </label>
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
                <label className="text-sm font-semibold text-slate-500">
                  Status
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      <span
                        className={
                          form.status ? "text-slate-700" : "text-slate-400"
                        }
                      >
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-500">
                Permissions
              </label>
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                {lookupsLoading ? (
                  <div className="min-w-0 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton
                        key={i}
                        className="h-9 w-full rounded-xl bg-neutral-200/60"
                      />
                    ))}
                  </div>
                ) : permissions.length === 0 ? (
                  <div className="px-2 py-8 text-center text-sm text-neutral-400">
                    No permissions found
                  </div>
                ) : (
                  <div className="min-w-0 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {permissions.map((p) => {
                      const checked = form.permissions.includes(p.name);
                      return (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => onTogglePermission(p.name)}
                          className={`group inline-flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs md:text-sm transition-all duration-200 overflow-hidden ${
                            checked
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_rgba(16,185,129,0.25)]"
                              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"
                          }`}
                        >
                          <span className="inline-flex min-w-0 flex-1 items-center gap-2">
                            <ListChecks
                              className={`h-4 w-4 ${
                                checked
                                  ? "text-emerald-500"
                                  : "text-slate-400"
                              }`}
                            />
                            <span className="truncate text-left">
                              {p.name}
                            </span>
                          </span>
                          <span
                            className={`ml-2 grid h-5 w-5 flex-none place-items-center rounded-full border transition ${
                              checked
                                ? "border-emerald-300 bg-emerald-500 text-white"
                                : "border-slate-300 text-transparent"
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Klik untuk memilih/meniadakan permission.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-400">
                Perubahan tersimpan akan tercatat untuk audit.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Saving" : "Save Changes"}
                </button>
              </div>
            </div>
            {successMessage && (
              <p className="mt-3 text-sm font-medium text-emerald-600">
                ✔ {successMessage}
              </p>
            )}
          </form>
        </DetailTwoColumnGrid>
      </DetailMainCard>
    </div>
  );
}

export default function EditRolePage() {
  const { loading, allowed } = usePermissionGuard(["mengubah roles"]);

  if (!loading && !allowed) {
    return <Forbidden />;
  }

  if (loading) {
    return null;
  }

  return <EditRolePageContent />;
}
