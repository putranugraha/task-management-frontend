"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listByTask,
  totalByTask,
  upsert,
  type TimeEntryPayload,
} from "@/lib/api/time-entries";
import { useAuth } from "@/contexts/auth-context";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";

type Props = {
  taskId: number;
};

type TimeEntry = {
  id: number;
  date: string;
  hours: number | string;
  note?: string | null;
  user?: { id: number; name: string } | null;
  user_id?: number;
};

export default function TaskTimeTrackerSection({ taskId }: Props) {
  const { state } = useAuth();
  const currentUserId = useMemo(
    () => Number(state.user?.id ?? (state.user as any)?.user_id ?? 0),
    [state.user]
  );
  const { loading: permLoading, allowed } = usePermissionGuard([
    "mengisi entri waktu",
  ]);

  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [totalHours, setTotalHours] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [timerStart, setTimerStart] = useState<number | null>(null);
  const storageKey = `task_timer_${taskId}`;

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const list = await listByTask(taskId);
      setEntries(list as any);
      const total = await totalByTask(taskId);
      setTotalHours(total);
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat entri waktu");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!taskId) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storageKey);
    const ts = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isNaN(ts)) {
      setTimerStart(ts);
    }
  }, [storageKey]);

  function handleStart() {
    const now = Date.now();
    setTimerStart(now);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, String(now));
    }
  }

  async function handleStop() {
    if (!timerStart || !currentUserId || !allowed) return;
    const now = Date.now();
    const diffMs = now - timerStart;
    const hours = Math.max(0, parseFloat((diffMs / 3_600_000).toFixed(2)));
    const date = new Date().toISOString().slice(0, 10);

    const payload: TimeEntryPayload = {
      task_id: Number(taskId),
      user_id: currentUserId,
      date,
      hours,
      note: "Timer dari UI",
    };

    try {
      await upsert(payload);
      setTimerStart(null);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(storageKey);
      }
      await fetchAll();
    } catch (e: any) {
      alert(e?.message ?? "Gagal menyimpan entri waktu");
    }
  }

  const runningHours = timerStart
    ? ((Date.now() - timerStart) / 3_600_000).toFixed(2)
    : null;

  return (
    <section className="mt-4">
      <h3 className="text-sm font-medium mb-2">Time Tracking</h3>
      <div className="border rounded-lg">
        {loading ? (
          <div className="p-3 text-sm text-neutral-500">
            Loading time entries...
          </div>
        ) : error ? (
          <div className="p-3 text-sm text-red-600">{error}</div>
        ) : entries.length === 0 ? (
          <div className="p-3 text-sm text-neutral-500">
            Belum ada time entry.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <th className="text-left font-medium px-3 py-2 border-b">
                  Date
                </th>
                <th className="text-left font-medium px-3 py-2 border-b">
                  Hours
                </th>
                <th className="text-left font-medium px-3 py-2 border-b">
                  User
                </th>
                <th className="text-left font-medium px-3 py-2 border-b">
                  Note
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const hrs =
                  typeof e.hours === "string"
                    ? parseFloat(e.hours)
                    : e.hours;
                const userName =
                  e.user?.name ??
                  (e.user_id ? `User #${e.user_id}` : "-");
                return (
                  <tr key={e.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 border-t">
                      {String(e.date).slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 border-t">{hrs}</td>
                    <td className="px-3 py-2 border-t">{userName}</td>
                    <td className="px-3 py-2 border-t">{e.note ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <div>
          <span className="inline-block px-2 py-0.5 rounded border bg-neutral-50">
            Total Hours: <b>{totalHours}</b>
          </span>
          {runningHours && (
            <span className="ml-2 text-xs text-neutral-600">
              Timer berjalan: {runningHours} jam
            </span>
          )}
        </div>

        {allowed && !permLoading && currentUserId > 0 && (
          <div className="space-x-2">
            {!timerStart ? (
              <button
                type="button"
                onClick={handleStart}
                className="px-3 py-1.5 rounded-md border text-sm hover:bg-neutral-50"
              >
                Start Timer
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                className="px-3 py-1.5 rounded-md border text-sm hover:bg-neutral-50"
              >
                Stop &amp; Save
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

