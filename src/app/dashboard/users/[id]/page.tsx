"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailMainCard, DetailTwoColumnGrid } from "@/components/layout/DetailCards";
import { ChevronLeft, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type UserDetail = {
  id: number;
  name: string;
  email: string;
  role?: string | null;
  roles?: Array<{ name: string }>;
  division?: { id: number; name: string } | null;
  job_title?: string | null;
  status?: string | null;
  is_active?: boolean;
  last_login_at?: string | null;
  email_verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

const getInitials = (name?: string | null, fallback?: string | null) => {
  const source = (name ?? fallback ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] ?? "").join("").toUpperCase();
};

const statusClasses = (value: string) => {
  const status = (value || "").toLowerCase();
  if (status.includes("non") || status.includes("inaktif") || status.includes("inactive")) {
    return "bg-rose-50 text-rose-500 ring-1 ring-rose-200";
  }
  if (status.includes("pending") || status.includes("wait")) {
    return "bg-amber-50 text-amber-500 ring-1 ring-amber-200";
  }
  return "bg-emerald-50 text-emerald-500 ring-1 ring-emerald-200";
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<any>("GET", `/api/users/${id}`);
        const payload = (res && typeof res === "object" && "data" in res) ? (res as any).data : res;
        const u = Array.isArray(payload) ? payload[0] : payload;
        const role = u?.role ?? (Array.isArray(u?.roles) && u.roles.length ? (typeof u.roles[0] === "string" ? u.roles[0] : u.roles[0]?.name) : null);
        const detail: UserDetail = {
          id: Number(u.id),
          name: u.name,
          email: u.email,
          role,
          division: u.division ? { id: Number(u.division.id), name: u.division.name } : null,
          job_title: u.job_title ?? null,
          status: u.status ?? "Aktif",
          is_active: Boolean(u.is_active ?? true),
          last_login_at: u.last_login_at ?? null,
          email_verified_at: u.email_verified_at ?? null,
          created_at: u.created_at,
          updated_at: u.updated_at,
        };
        if (mounted) setData(detail);
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Gagal memuat user";
        setError(msg);
        showToast({
          variant: "error",
          title: "Gagal memuat user",
          description: msg,
        });
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { mounted = false; };
  }, [id]);

  const handleBack = () => router.push("/dashboard/users");

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleBack}
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

        <DetailMainCard>
          <DetailTwoColumnGrid>
            <aside className="flex h-full flex-col gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-white/30 animate-pulse" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40 rounded" />
                  <Skeleton className="h-3 w-48 rounded" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </aside>

            <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[...Array(8)].map((_, i) => (
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

  if (error) return <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">{error}</div>;
  if (!data) return <div className="text-sm text-slate-500">Not found</div>;

  const statusBadge = (
    <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", statusClasses(data.status ?? "")].join(" ")}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current/40" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      {data.status ?? "-"}
    </span>
  );

  const situation = data.is_active ? (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
      <ShieldCheck className="h-4 w-4" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">
      <AlertCircle className="h-4 w-4" /> Inactive
    </span>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleBack}
            className="group inline-flex items-center gap-2 text-sm font-medium text-[#00674F] transition hover:text-[#008061]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00674F]/10 text-[#00674F] transition group-hover:bg-[#008061]/20 group-hover:text-[#008061]">
              <ChevronLeft className="h-4 w-4" />
            </span>
            Back to Users
          </button>
          <h1 className="text-3xl font-semibold text-slate-900">User Detail</h1>
          <p className="max-w-xl text-sm text-slate-500">Profil dan informasi akun pengguna.</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/dashboard/users/${data.id}/edit`}
            className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
          >
            Edit User
          </a>
        </div>
      </div>

      <DetailMainCard>
        <DetailTwoColumnGrid>
          {/* Profile summary */}
          <aside className="flex h-full flex-col gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-white/20 grid place-items-center text-lg font-bold">
                {getInitials(data.name, data.email)}
              </div>
              <div className="min-w-0">
                <div className="text-xl font-semibold text-white">{data.name}</div>
                <div className="mt-1 inline-flex items-center gap-2 text-sm text-white/80">
                  <Mail className="h-4 w-4" />
                  <span className="truncate max-w-[220px] md:max-w-[260px]">{data.email}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {data.role && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                  {data.role}
                </span>
              )}
              {data.division?.name && (
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
                  {data.division.name}
                </span>
              )}
              {statusBadge}
              {situation}
            </div>
            {data.job_title && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-800/20 p-4 text-white/80 backdrop-blur-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">Job Title</p>
                <p className="text-sm leading-relaxed">{data.job_title}</p>
              </div>
            )}
          </aside>

          {/* Details card */}
          <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">Account Information</h2>
              <p className="text-xs text-neutral-400">Detail atribut pengguna dan metadata akun.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Row label="Name" value={data.name} />
              <Row label="Email" value={data.email} />
              <Row label="Role" value={data.role ?? "-"} />
              <Row label="Division" value={data.division?.name ?? "-"} />
              <Row label="Status" value={data.status ?? "-"} />
              <Row label="Active" value={data.is_active ? "Yes" : "No"} />
              <Row label="Last Login" value={data.last_login_at ?? "-"} />
              <Row label="Email Verified" value={data.email_verified_at ?? "-"} />
              <Row label="Created At" value={data.created_at ?? "-"} />
              <Row label="Updated At" value={data.updated_at ?? "-"} />
            </div>
          </div>
        </DetailTwoColumnGrid>
      </DetailMainCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-inner grid place-items-center text-center md:text-left md:place-items-start">
        <span className="truncate w-full">{value}</span>
      </div>
    </div>
  );
}
