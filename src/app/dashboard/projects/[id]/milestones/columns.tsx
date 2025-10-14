"use client";

import { useState } from "react";
import type { Milestone } from "@/types/milestone";
import { MILESTONE_STATUS_OPTIONS, complete, updateStatus } from "@/lib/api/milestones";

export type MilestoneRow = Pick<Milestone, 'id' | 'name' | 'status' | 'due_planned'> & {
  project?: { id: number; name: string } | null;
};

export type Column<T> = {
  key: keyof T | "actions";
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function useMilestoneColumns({ onDelete, onChanged }: { onDelete?: (row: MilestoneRow) => void; onChanged?: () => void; }): Column<MilestoneRow>[] {
  return [
    { key: "name", header: "Name" },
    { key: "status", header: "Status" },
    { key: "due_planned", header: "Due Planned", render: (r) => r.due_planned ?? '-' },
    {
      key: "actions",
      header: "Actions",
      render: (row) => <RowActions row={row} onDelete={onDelete} onChanged={onChanged} />,
    },
  ];
}

function RowActions({ row, onDelete, onChanged }: { row: MilestoneRow; onDelete?: (row: MilestoneRow) => void; onChanged?: () => void; }) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>(row.status);

  const doComplete = async () => {
    const ok = confirm(`Mark milestone \"${row.name}\" as Completed?`);
    if (!ok) return;
    try {
      setSaving(true);
      await complete(row.id);
      onChanged?.();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to complete');
    } finally { setSaving(false); }
  };

  const doUpdateStatus = async () => {
    try {
      setSaving(true);
      await updateStatus(row.id, status as any);
      onChanged?.();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update status');
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/milestones/${row.id}`}>Detail</a>
      <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/milestones/${row.id}/edit`}>Edit</a>
      <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => onDelete?.(row)}>Delete</button>
      <button className="px-2 py-1 rounded-md border hover:bg-neutral-50" disabled={saving} onClick={doComplete}>Mark Completed</button>
      <div className="inline-flex items-center gap-2">
        <select className="border rounded-md px-2 py-1" value={status} onChange={(e) => setStatus(e.target.value)}>
          {MILESTONE_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="px-2 py-1 rounded-md border hover:bg-neutral-50" disabled={saving} onClick={doUpdateStatus}>Update Status</button>
      </div>
    </div>
  );
}
