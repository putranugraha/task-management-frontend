"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { DetailMainCard, DetailTwoColumnGrid } from "@/components/layout/DetailCards";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";
import { useAuth } from "@/contexts/auth-context";

type DivisionDetail = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  users?: { id: number; name: string; email?: string }[];
  users_count?: number;
  created_at?: string;
  updated_at?: string;
};

function DivisionDetailPageContent() {
  const params = useParams();
  const id = Number(params?.id);
  const { can } = useAuth();
  const canUpdateDivision = can("mengubah divisions");

  const [data, setData] = useState<DivisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<any>("GET", `/api/divisions/${id}?with_users=true&with_users_count=true`);
        const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
        const d = Array.isArray(payload) ? payload[0] : payload;
        let users: { id: number; name: string; email?: string }[] | undefined;
        const raw = d?.users ?? d?.members ?? d?.users_list;
        if (Array.isArray(raw)) {
          users = raw.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email ?? String(u.id), email: u.email }));
        } else if (raw && Array.isArray(raw?.data)) {
          users = raw.data.map((u: any) => ({ id: Number(u.id), name: u.name ?? u.full_name ?? u.email ?? String(u.id), email: u.email }));
        }
        const detail: DivisionDetail = {
          id: Number(d.id),
          code: String(d.code ?? ''),
          name: d.name ?? d.division_name ?? d.title ?? d.label ?? '',
          description: d.description ?? null,
          users,
          users_count: typeof d.users_count === 'number' ? d.users_count : (Array.isArray(users) ? users.length : undefined),
          created_at: d.created_at ?? '',
          updated_at: d.updated_at ?? '',
        };
        if (mounted) setData(detail);
      } catch (e: any) {
        setError(e?.message ?? 'Gagal memuat division');
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div>Not found</div>;

  const userNames = Array.isArray(data.users) && data.users.length > 0
    ? data.users.map((u) => u.name).join(', ')
    : '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900">Division Detail</h1>
          <p className="max-w-xl text-sm text-slate-500">
            Informasi lengkap mengenai divisi dan anggota terkait.
          </p>
        </div>
        <div className="flex gap-2">
          {canUpdateDivision && (
            <a
              href={`/dashboard/divisions/${data.id}/edit`}
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
            >
              Edit Division
            </a>
          )}
          <button
            type="button"
            onClick={() => history.back()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300"
          >
            Back
          </button>
        </div>
      </div>

      <DetailMainCard>
        <DetailTwoColumnGrid>
          <aside className="flex h-full flex-col gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
            <div className="space-y-3">
              <p className="text-xs font-bold tracking-[0.32em] text-emerald-100/80">
                DIVISION
              </p>
              <h2 className="text-2xl font-semibold text-white">{data.name}</h2>
              {data.code && (
                <p className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90">
                  Code: {data.code}
                </p>
              )}
            </div>
            <div className="space-y-3 text-sm text-white/85">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100/80">
                Summary
              </p>
              <p>
                Total Users:{" "}
                <span className="font-semibold">
                  {String(data.users_count ?? data.users?.length ?? 0)}
                </span>
              </p>
              <p>
                Created At:{" "}
                <span className="font-semibold">
                  {data.created_at ?? "-"}
                </span>
              </p>
              <p>
                Updated At:{" "}
                <span className="font-semibold">
                  {data.updated_at ?? "-"}
                </span>
              </p>
            </div>
          </aside>

          <div className="flex h-full flex-col gap-6 rounded-2xl border border-neutral-100 bg-gradient-to-br from-white to-neutral-50 p-6 shadow-sm">
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                Division Information
              </h2>
              <p className="text-xs text-neutral-400">
                Detail atribut divisi dan daftar anggota yang terkait.
              </p>
            </div>
            <div className="space-y-4">
              <Row label="Code" value={data.code || "-"} />
              <Row label="Name" value={data.name} />
              <Row label="Description" value={data.description ?? "-"} />
              <Row label="Users" value={userNames} />
              <Row
                label="Total Users"
                value={String(data.users_count ?? data.users?.length ?? 0)}
              />
              <Row label="Created At" value={data.created_at ?? "-"} />
              <Row label="Updated At" value={data.updated_at ?? "-"} />
            </div>
          </div>
        </DetailTwoColumnGrid>
      </DetailMainCard>
    </div>
  );
}

export default function DivisionDetailPage() {
  const { loading, allowed } = usePermissionGuard(["melihat divisions"]);

  if (!loading && !allowed) {
    return <Forbidden />;
  }

  if (loading) {
    return null;
  }

  return <DivisionDetailPageContent />;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-inner flex items-center">
        <span className="w-full truncate whitespace-nowrap">{value}</span>
      </div>
    </div>
  );
}
