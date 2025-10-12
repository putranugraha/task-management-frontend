"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

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

export default function UserDetailPage() {
  const params = useParams();
  const id = Number(params?.id);

  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<any>("GET", `/api/users/${id}`);
        const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
        const u = Array.isArray(payload) ? payload[0] : payload;
        const role = u.role ?? (Array.isArray(u.roles) && u.roles.length ? (typeof u.roles[0] === 'string' ? u.roles[0] : u.roles[0]?.name) : null);
        const detail: UserDetail = {
          id: Number(u.id),
          name: u.name,
          email: u.email,
          role,
          division: u.division ? { id: Number(u.division.id), name: u.division.name } : null,
          job_title: u.job_title ?? null,
          status: u.status ?? 'Aktif',
          is_active: Boolean(u.is_active ?? true),
          last_login_at: u.last_login_at ?? null,
          email_verified_at: u.email_verified_at ?? null,
          created_at: u.created_at,
          updated_at: u.updated_at,
        };
        if (mounted) setData(detail);
      } catch (e: any) {
        setError(e?.message ?? 'Gagal memuat user');
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

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-3">User Detail</h2>
      <div className="grid gap-2 border rounded-lg p-4">
        <Row label="Name" value={data.name} />
        <Row label="Email" value={data.email} />
        <Row label="Role" value={data.role ?? '-'} />
        <Row label="Division" value={data.division?.name ?? '-'} />
        <Row label="Job Title" value={data.job_title ?? '-'} />
        <Row label="Status" value={data.status ?? '-'} />
        <Row label="Active" value={data.is_active ? 'Yes' : 'No'} />
        <Row label="Last Login" value={data.last_login_at ?? '-'} />
        <Row label="Email Verified" value={data.email_verified_at ?? '-'} />
        <Row label="Created At" value={data.created_at ?? '-'} />
        <Row label="Updated At" value={data.updated_at ?? '-'} />
      </div>
      <div className="mt-3 flex gap-2">
        <a href={`/dashboard/users/${data.id}/edit`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Edit</a>
        <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Back</button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-sm">
      <div className="text-neutral-500">{label}</div>
      <div className="font-medium break-words">{value}</div>
    </div>
  );
}

