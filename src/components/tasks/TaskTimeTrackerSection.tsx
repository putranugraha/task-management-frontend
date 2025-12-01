"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listByTask,
  totalByTask,
  upsert,
  type TimeEntryPayload,
} from "@/lib/api/time-entries";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

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
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [userNamesById, setUserNamesById] = useState<Record<number, string>>(
    {}
  );

  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState<number | null>(null);
  const storageKey = `task_timer_${taskId}`;
  const { showToast } = useToast();
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [savingTimer, setSavingTimer] = useState(false);

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const list = await listByTask(taskId);
      setEntries(list as any);
      const total = await totalByTask(taskId);
      setTotalHours(total);
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.code;
      const msg = String(e?.message || "");
      const isTimeout =
        code === "ECONNABORTED" ||
        status === 408 ||
        status === 504 ||
        /timeout/i.test(msg) ||
        /timed out/i.test(msg);

      if (isTimeout) {
        // Untuk timeout, anggap saja data kosong supaya UI tetap jalan.
        setEntries([]);
        setTotalHours(0);
        setError(null);
      } else {
        setError(e?.message ?? "Gagal memuat entri waktu");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!taskId) return;
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // Tick waktu saat timer sedang berjalan supaya "Timer berjalan" live
  useEffect(() => {
    if (!timerStart) {
      setNowTs(null);
      return;
    }
    if (typeof window === "undefined") return;

    setNowTs(Date.now());
    const id = window.setInterval(() => {
      setNowTs(Date.now());
    }, 10_000); // update setiap 10 detik

    return () => {
      window.clearInterval(id);
    };
  }, [timerStart]);

  // Fetch user list so we can resolve user_id -> nama user
  useEffect(() => {
    (async () => {
      try {
        const tryPaths = [
          "/api/users/options?status=1",
          "/api/users/options?status=Aktif",
          "/api/users/options",
          "/api/users?status=1",
          "/api/users?status=Aktif",
          "/api/users",
        ];
        let mapped: Array<{ id: number; name: string }> = [];
        for (const path of tryPaths) {
          try {
            const rs = await apiRequest<any>("GET", path);
            let arr: any[] = [];
            if (Array.isArray(rs)) arr = rs;
            else if (Array.isArray((rs as any)?.data)) arr = (rs as any).data;
            else if (Array.isArray((rs as any)?.data?.data))
              arr = (rs as any).data.data;
            else if (Array.isArray((rs as any)?.items)) arr = (rs as any).items;
            else if (Array.isArray((rs as any)?.users)) arr = (rs as any).users;

            mapped = (arr || []).map((u: any) => ({
              id: Number(u.id),
              name:
                u.name ??
                u.full_name ??
                u.username ??
                u.email ??
                String(u.id),
            }));
            if (mapped.length) break;
          } catch {
            // coba path berikutnya
          }
        }
        setUsers(mapped);
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  // Jika masih ada user_id yang belum ketemu di daftar users,
  // coba fetch detail user per-ID agar bisa tampilkan username lama/inaktif.
  useEffect(() => {
    (async () => {
      const knownIds = new Set<number>([
        ...users.map((u) => Number(u.id)),
        ...Object.keys(userNamesById).map((k) => Number(k)),
      ]);
      const toResolve = Array.from(
        new Set(
          entries
            .map((e) => Number(e.user_id ?? e.user?.id ?? 0))
            .filter((id) => Number.isFinite(id) && id > 0 && !knownIds.has(id))
        )
      );
      if (toResolve.length === 0) return;

      const updates: Record<number, string> = {};
      for (const uid of toResolve) {
        try {
          const res = await apiRequest<any>("GET", `/api/users/${uid}`);
          const payload =
            res && typeof res === "object" && "data" in (res as any)
              ? (res as any).data
              : res;
          const name =
            payload?.name ??
            payload?.full_name ??
            payload?.username ??
            payload?.email ??
            String(uid);
          updates[uid] = name;
        } catch {
          // kalau gagal, biarkan fallback ke "User #id"
        }
      }
      if (Object.keys(updates).length) {
        setUserNamesById((prev) => ({ ...prev, ...updates }));
      }
    })();
  }, [entries, users, userNamesById]);

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
    if (!timerStart) {
      showToast({
        variant: "warning",
        title: "Timer belum berjalan",
        description: "Tidak ada timer aktif untuk disimpan.",
      });
      setStopConfirmOpen(false);
      return;
    }
    if (!allowed || permLoading) {
      showToast({
        variant: "error",
        title: "Tidak memiliki izin",
        description: "Kamu tidak diizinkan menyimpan entri waktu untuk task ini.",
      });
      setStopConfirmOpen(false);
      return;
    }
    if (!currentUserId) {
      showToast({
        variant: "error",
        title: "User tidak valid",
        description: "User yang aktif tidak dikenali, entri waktu tidak dapat disimpan.",
      });
      setStopConfirmOpen(false);
      return;
    }

    setSavingTimer(true);
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
      setStopConfirmOpen(false);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menyimpan entri waktu";
      showToast({
        variant: "error",
        title: "Gagal menyimpan entri waktu",
        description: msg,
      });
    } finally {
      setSavingTimer(false);
    }
  }

  const runningHours =
    timerStart && nowTs
      ? ((nowTs - timerStart) / 3_600_000).toFixed(2)
      : null;

  const userMap = useMemo(() => {
    const map = new Map<number, string>();
    users.forEach((u) => {
      if (Number.isFinite(u.id)) {
        map.set(Number(u.id), u.name);
      }
    });
     Object.entries(userNamesById).forEach(([id, name]) => {
       const uid = Number(id);
       if (Number.isFinite(uid)) {
         map.set(uid, name);
       }
     });
     if (currentUserId && state.user?.name) {
       map.set(currentUserId, state.user.name);
     }
    return map;
  }, [users, userNamesById, currentUserId, state.user?.name]);

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
            Kosong / belum ada time entry.
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
                const userId = Number(e.user_id ?? e.user?.id ?? 0);
                const userName =
                  e.user?.name ??
                  (Number.isFinite(userId) && userId > 0
                    ? userMap.get(userId) ?? `User #${userId}`
                    : "-");
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
                onClick={() => {
                  if (!allowed || permLoading) {
                    showToast({
                      variant: "error",
                      title: "Tidak memiliki izin",
                      description: "Kamu tidak diizinkan memulai timer untuk task ini.",
                    });
                    return;
                  }
                  if (!currentUserId || currentUserId <= 0) {
                    showToast({
                      variant: "error",
                      title: "User tidak valid",
                      description: "User yang aktif tidak dikenali, timer tidak dapat dimulai.",
                    });
                    return;
                  }
                  setStartConfirmOpen(true);
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
              >
                Start Timer
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStopConfirmOpen(true)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
              >
                Stop &amp; Save
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={startConfirmOpen}
        title="Mulai timer untuk task ini?"
        description="Timer waktu akan mulai berjalan dan dicatat hingga kamu menekan Stop & Save."
        confirmLabel="Mulai"
        cancelLabel="Batal"
        variant="default"
        loading={false}
        onConfirm={() => {
          setStartConfirmOpen(false);
          handleStart();
        }}
        onCancel={() => setStartConfirmOpen(false)}
      />

      <ConfirmDialog
        open={stopConfirmOpen}
        title="Hentikan dan simpan waktu?"
        description="Timer akan dihentikan dan entri waktu baru akan disimpan berdasarkan durasi yang sudah berjalan."
        confirmLabel="Stop & Save"
        cancelLabel="Batal"
        variant="default"
        loading={savingTimer}
        onConfirm={handleStop}
        onCancel={() => !savingTimer && setStopConfirmOpen(false)}
      />
    </section>
  );
}
