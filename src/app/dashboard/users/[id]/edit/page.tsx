"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { Division } from "@/types/division";
import { fetchRolesList, fetchDivisionsList, type SimpleRole } from "@/lib/lookups";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

type FormState = {
  id: number;
  name: string;
  email: string;
  job_title: string;
  is_active: boolean;
  status: string;
  division_id: number | "";
  role_id: number | "";
  role_name: string;
};

export default function EditUserPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [form, setForm] = useState<FormState | null>(null);
  const [password, setPassword] = useState("");
  const [password_confirmation, setPasswordConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(true);
  const [roles, setRoles] = useState<SimpleRole[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await apiRequest<any>("GET", `/api/users/${id}`);
        const payload = (data && typeof data === "object" && "data" in data) ? (data as any).data : data;
        const u = Array.isArray(payload) ? payload[0] : payload;
        if (!u) throw new Error("User tidak ditemukan");
        if (mounted) {
          const roleFromArray = Array.isArray(u.roles) && u.roles.length
            ? (typeof u.roles[0] === "string" ? u.roles[0] : u.roles[0]?.name)
            : "";
          setForm({
            id: Number(u.id),
            name: u.name ?? "",
            email: u.email ?? "",
            job_title: u.job_title ?? "",
            is_active: Boolean(u.is_active ?? true),
            status: u.status ?? "Aktif",
            division_id: (u.division?.id as number) ?? "",
            role_id: "",
            role_name: u.role ?? roleFromArray ?? "",
          });
        }
      } catch (e: any) {
        setError(e?.message ?? "Gagal memuat data user");
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const normalized = await fetchRolesList();
        if (mounted) {
          setRoles(normalized);
        }
      } catch {
        try {
          const us = await apiRequest<any>("GET", "/api/users");
          const list = Array.isArray(us) ? us : (us?.data ?? []);
          const names: string[] = Array.from(new Set(list
            .map((u: any) => u.role)
            .filter((v: any): v is string => typeof v === "string")
          ));
          if (mounted) setRoles(names.map((n, i): SimpleRole => ({ id: i + 1, name: n })));
        } catch {}
      }
      try {
        const normalizedDivs = await fetchDivisionsList();
        if (mounted) setDivisions(normalizedDivs);
      } catch {}
      if (mounted) setLookupsLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // After roles loaded and form has role_name, try to map to role_id
    if (form && !form.role_id && form.role_name && roles.length) {
      const found = roles.find((r) => r.name === form.role_name);
      if (found) setForm((s) => (s ? { ...s, role_id: found.id } : s));
    }
  }, [roles, form?.role_name]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any;
    setForm((s) => (s ? { ...s, [name]: type === "checkbox" ? checked : value } : s));
  };

  const handleCancel = () => {
    if (submitting) return;
    router.push("/dashboard/users");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if ((password || password_confirmation) && password !== password_confirmation) {
        setError("Password dan konfirmasi tidak sama");
        setSubmitting(false);
        return;
      }
      const payload: Record<string, any> = {
        name: form.name,
        email: form.email,
        job_title: form.job_title || null,
        is_active: form.is_active,
        status: form.status,
        division_id: form.division_id || null,
      };
      if (form.role_name) payload.role = form.role_name;
      if (form.role_id) payload.role_id = form.role_id;
      if (password) {
        payload.password = password;
        payload.password_confirmation = password_confirmation;
      }
      await apiRequest("PUT", `/api/users/${form.id}`, payload);
      setSuccessMessage("Perubahan user berhasil disimpan.");
      setTimeout(() => router.push("/dashboard/users"), 900);
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan user");
    } finally {
      setSubmitting(false);
    }
  };

  const checklistItems = useMemo(() => {
    const credentialsDone = (!password && !password_confirmation) ||
      (password && password_confirmation && password === password_confirmation);
    return [
      {
        key: "name",
        label: "Isi nama dan email dengan benar",
        completed: Boolean(form?.name && form?.email),
      },
      {
        key: "credentials",
        label: "Ganti password (opsional) dengan konfirmasi",
        completed: credentialsDone,
      },
      {
        key: "role",
        label: "Pilih role dan division yang sesuai",
        completed: Boolean(form?.role_id || form?.division_id),
      },
      {
        key: "status",
        label: "Pastikan status aktif sesuai kebutuhan",
        completed: Boolean(form?.is_active),
      },
    ];
  }, [form, password, password_confirmation]);

  const checklistProgress = useMemo(() => {
    const total = checklistItems.length;
    const done = checklistItems.filter((item) => item.completed).length;
    return Math.round((done / total) * 100);
  }, [checklistItems]);

  const selectedRole = useMemo(() => {
    if (!form?.role_id) return null;
    return roles.find((role) => role.id === Number(form.role_id)) ?? null;
  }, [roles, form?.role_id]);

  const selectedDivision = useMemo(() => {
    if (!form?.division_id) return null;
    return divisions.find((division) => division.id === Number(form.division_id)) ?? null;
  }, [divisions, form?.division_id]);

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
              Back to Users
            </button>
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-4 w-80 rounded-md" />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{error}</div>
        )}

        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <aside className="flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="w-full rounded-full bg-emerald-800/30">
                  <div className="h-1 w-1/2 rounded-full bg-white/70 animate-pulse" />
                </div>
                <div className="h-5 w-40 rounded-md bg-white/20" />
              </div>
              <ul className="space-y-3 text-sm leading-relaxed">
                {[1,2,3,4].map((i) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2">
                    <div className="h-5 w-5 flex-none rounded-full bg-white/30 animate-pulse" />
                    <div className="h-3 w-3/4 rounded-md bg-white/30 animate-pulse" />
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
              <div className="h-3 w-16 rounded bg-white/20 mb-2" />
              <div className="h-3 w-2/3 rounded bg-white/20" />
            </div>
          </aside>

          <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>

            {/* Row 1 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              </div>
            </div>

            {/* Row 3 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12 rounded" />
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              </div>
            </div>

            {/* Row 4 */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-14 rounded" />
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Skeleton className="h-3 w-64 rounded" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-24 rounded-full" />
                <Skeleton className="h-9 w-32 rounded-full" />
              </div>
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
            Back to Users
          </button>
          <h1 className="text-3xl font-semibold text-slate-900">Edit User</h1>
          <p className="max-w-xl text-sm text-slate-500">
            Perbarui informasi anggota tim dan pastikan akses serta peran tetap sesuai.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-xl">
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="w-full rounded-full bg-emerald-800/30">
                <div
                  className="h-1 rounded-full bg-white/80 transition-all duration-500"
                  style={{ width: `${checklistProgress}%` }}
                />
              </div>
              <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">Onboarding Checklist</h2>
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
            <p className="text-sm leading-relaxed">
              Password bersifat opsional saat edit. Jika diisi, pastikan konfirmasi sama.
            </p>
          </div>
        </aside>

        <form
          onSubmit={onSubmit}
          className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm"
        >
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Account Details</h2>
            <p className="text-xs text-neutral-400">Perbarui informasi akun pengguna.</p>
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
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-semibold text-slate-500">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                placeholder="john@company.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-semibold text-slate-500">Password (optional)</label>
              <input
                id="password"
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password_confirmation" className="text-sm font-semibold text-slate-500">Confirm Password</label>
              <input
                id="password_confirmation"
                type="password"
                name="password_confirmation"
                value={password_confirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                placeholder="Repeat password"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-500">Role</label>
              {lookupsLoading ? (
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={lookupsLoading}
                      className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      <span className={selectedRole ? "text-slate-700" : "text-slate-400"}>
                        {selectedRole?.name ?? (form.role_name || "Pilih role")}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="min-w-[220px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
                  >
                    {roles.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-neutral-400">Tidak ada data</div>
                    ) : (
                      roles.map((role) => (
                        <DropdownMenuItem
                          key={role.id}
                          onSelect={() => {
                            setForm((s) => (s ? { ...s, role_id: role.id, role_name: role.name } : s));
                          }}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                        >
                          <span>{role.name}</span>
                          {form.role_id === role.id && <Check className="h-4 w-4 text-emerald-500" />}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <p className="text-xs text-slate-400">Role membantu mengatur hak akses dan notifikasi.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="job_title" className="text-sm font-semibold text-slate-500">Job Title</label>
              <input
                id="job_title"
                name="job_title"
                value={form.job_title}
                onChange={onChange}
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                placeholder="Product Manager"
                autoComplete="organization-title"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-500">Division</label>
              {lookupsLoading ? (
                <Skeleton className="h-11 w-full rounded-xl bg-neutral-200/50" />
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      <span className={selectedDivision ? "text-slate-700" : "text-slate-400"}>
                        {selectedDivision?.name ?? "(Optional) Pilih division"}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="min-w-[220px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
                  >
                    <DropdownMenuItem
                      onSelect={() => {
                        setForm((s) => (s ? { ...s, division_id: "" } : s));
                      }}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                    >
                      <span>Tidak ada division</span>
                      {form.division_id === "" && <Check className="h-4 w-4 text-emerald-500" />}
                    </DropdownMenuItem>
                    {divisions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-neutral-400">Tidak ada data</div>
                    ) : (
                      divisions.map((division) => (
                        <DropdownMenuItem
                          key={division.id}
                          onSelect={() => {
                            setForm((s) => (s ? { ...s, division_id: division.id } : s));
                          }}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700"
                        >
                          <span>{division.name}</span>
                          {Number(form.division_id) === division.id && <Check className="h-4 w-4 text-emerald-500" />}
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-500">Status</label>
              <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 px-4 shadow-inner">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={form.is_active}
                    onChange={onChange}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-300"
                  />
                  Active
                </label>
                <span className="h-4 w-px bg-slate-200" />
                <select
                  name="status"
                  value={form.status}
                  onChange={onChange}
                  className="rounded-lg border border-transparent bg-slate-50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition-all duration-300 hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_12px_24px_rgba(16,185,129,0.2)] focus:outline-none"
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Non Aktif">Non Aktif</option>
                </select>
              </div>
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
                {submitting ? "Saving" : "Save Changes"}
              </button>
            </div>
          </div>
          {successMessage && (
            <p className="mt-3 text-sm font-medium text-emerald-600">✔ {successMessage}</p>
          )}
        </form>
      </div>
    </div>
  );
}
