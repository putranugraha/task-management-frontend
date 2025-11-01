"use client";

import * as React from "react";
import { upsert, listByTask, type TimeEntryPayload } from "@/lib/api/time-entries";

type Props = {
  taskId: number | string;
  userId: number | string;
  onSaved?: () => void;
  className?: string;
};

function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function TimeEntryForm({ taskId, userId, onSaved, className }: Props) {
  const [date, setDate] = React.useState<string>(todayISO());
  const [hours, setHours] = React.useState<number>(1);
  const [note, setNote] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Determine additive hours if there is an existing same-day entry for this user
      let newHours = Number(hours);
      try {
        const entries = await listByTask(taskId);
        const sameDay = (entries || []).find((it: any) => Number(it?.user_id) === Number(userId) && String(it?.date || "").slice(0, 10) === date);
        if (sameDay) {
          const existing = typeof sameDay.hours === 'string' ? parseFloat(sameDay.hours) : Number(sameDay.hours);
          const add = typeof hours === 'string' ? parseFloat(hours as any) : Number(hours);
          const base = Number.isFinite(existing) ? existing : 0;
          const inc = Number.isFinite(add) ? add : 0;
          newHours = base + inc;
        }
      } catch {
        // If fetch fails, fall back to raw input hours
      }

      const payload: TimeEntryPayload = {
        task_id: Number(taskId),
        user_id: Number(userId),
        date,
        hours: newHours,
        note: note?.trim() || null,
      };
      await upsert(payload);
      onSaved?.();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to save time");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-neutral-600 mb-1">Date</label>
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-600 mb-1">Hours</label>
          <input
            type="number"
            step={0.25}
            min={0}
            className="border rounded px-2 py-1 text-sm w-24"
            value={hours}
            onChange={(e) => setHours(parseFloat(e.target.value || "0"))}
            required
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-neutral-600 mb-1">Note</label>
          <input
            type="text"
            className="border rounded px-2 py-1 text-sm w-full"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-2 py-1 rounded text-sm hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? "Saving..." : "Log Time"}
        </button>
      </div>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </form>
  );
}
