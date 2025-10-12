"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

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

export default function DivisionDetailPage() {
  const params = useParams();
  const id = Number(params?.id);

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
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-3">Division Detail</h2>
      <div className="grid gap-2 border rounded-lg p-4">
        <Row label="Code" value={data.code} />
        <Row label="Name" value={data.name} />
        <Row label="Description" value={data.description ?? '-'} />
        <Row label="Users" value={userNames} />
        <Row label="Total Users" value={String(data.users_count ?? (data.users?.length ?? 0))} />
        <Row label="Created At" value={data.created_at ?? '-'} />
        <Row label="Updated At" value={data.updated_at ?? '-'} />
      </div>
      <div className="mt-3 flex gap-2">
        <a href={`/dashboard/divisions/${data.id}/edit`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Edit</a>
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

