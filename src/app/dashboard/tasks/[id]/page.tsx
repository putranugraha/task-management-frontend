"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

type Assignment = { user?: { id: number; name: string } | null; user_id?: number; role_on_task?: string | null; estimated_effort_hours?: number | null };
type Dependency = { type?: 'FS'|'SS'|'FF'|'SF'; lag_days?: number; depends_on?: { id: number; title: string } | null };

export default function TaskDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<any>("GET", `/api/tasks/${id}`);
        const payload = (res && typeof res === 'object' && 'data' in res) ? (res as any).data : res;
        if (mounted) setData(payload);
      } catch (e: any) {
        setError(e?.message ?? 'Gagal memuat task');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div>Not found</div>;

  const ass: Assignment[] = Array.isArray(data?.assignments) ? data.assignments : [];
  const deps: Dependency[] = Array.isArray(data?.dependencies) ? data.dependencies : [];

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-3">Task Detail</h2>
      <div className="grid gap-2 border rounded-lg p-4 text-sm">
        <Row label="Title" value={data.title} />
        <Row label="Project" value={data.project?.name ?? data.project_id ?? '-'} />
        <Row label="Milestone" value={data.milestone?.name ?? data.milestone_id ?? '-'} />
        <Row label="Priority" value={data.priority ?? 'Medium'} />
        <Row label="Status" value={data.status ?? 'To Do'} />
        <Row label="Start Planned" value={data.start_planned ?? '-'} />
        <Row label="End Planned" value={data.end_planned ?? '-'} />
        <Row label="Percent" value={`${Number(data.percent_complete ?? 0)}%`} />
      </div>

      <section className="mt-4">
        <h3 className="text-sm font-medium mb-2">Assignments</h3>
        <div className="border rounded-lg">
          {ass.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">No assignments</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b">User</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Role</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Effort (h)</th>
                </tr>
              </thead>
              <tbody>
                {ass.map((a, idx) => {
                  const name = a.user?.name ?? String(a.user_id ?? '');
                  const role = (a.role_on_task ?? '').trim();
                  const eff = (a.estimated_effort_hours ?? null);
                  return (
                    <tr key={idx} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 border-t">{name || '-'}</td>
                      <td className="px-3 py-2 border-t">{role || '-'}</td>
                      <td className="px-3 py-2 border-t">{typeof eff === 'number' ? eff : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-4">
        <h3 className="text-sm font-medium mb-2">Dependencies</h3>
        <div className="border rounded-lg">
          {deps.length === 0 ? (
            <div className="p-3 text-sm text-neutral-500">No dependencies</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-700">
                <tr>
                  <th className="text-left font-medium px-3 py-2 border-b">Depends On</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Type</th>
                  <th className="text-left font-medium px-3 py-2 border-b">Lag (days)</th>
                </tr>
              </thead>
              <tbody>
                {deps.map((d, idx) => (
                  <tr key={idx} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 border-t">{d.depends_on?.title ?? '-'}</td>
                    <td className="px-3 py-2 border-t">{d.type ?? 'FS'}</td>
                    <td className="px-3 py-2 border-t">{typeof d.lag_days === 'number' ? d.lag_days : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div className="mt-3 flex gap-2">
        <a href={`/dashboard/tasks/${id}/edit`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Edit</a>
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

