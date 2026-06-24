"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  BellDot,
  CheckCircle2,
  Clock3,
  FileText,
  ListTodo,
  MessageCircle,
  Paperclip,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import {
  listMyNotifications,
  markNotificationRead,
  type NotificationsMeta,
  type TaskNotification,
} from "@/lib/api/notifications";
import { RowsPerPageControl } from "@/components/dashboard/RowsPerPageControl";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useNotifications } from "@/contexts/notification-context";

type NotificationRow = TaskNotification;

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function getEventLabel(event: string): string {
  switch (event) {
    case "task_assigned":
      return "Penugasan baru pada task";
    case "attachment_uploaded":
      return "Attachment baru diunggah";
    case "attachment_approved":
      return "Attachment telah disetujui";
    case "attachment_rejected":
      return "Attachment telah ditolak";
    case "comment_added":
      return "Komentar baru ditambahkan";
    case "task_status_changed":
      return "Status task berubah";
    case "task_progress_updated":
      return "Progress task diperbarui";
    case "task_due_soon":
      return "Task mendekati deadline";
    case "task_overdue":
      return "Task terlambat";
    default:
      return event || "Notifikasi";
  }
}

function EventIcon({ event, unread }: { event: string; unread: boolean }) {
  const base =
    "flex h-10 w-10 items-center justify-center rounded-full shadow-sm";

  if (event === "task_assigned") {
    return (
      <div
        className={`${base} bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100`}
      >
        <ListTodo className="h-5 w-5" />
      </div>
    );
  }

  if (event === "attachment_uploaded") {
    return (
      <div
        className={`${base} bg-sky-50 text-sky-600 ring-1 ring-sky-100`}
      >
        <Paperclip className="h-5 w-5" />
      </div>
    );
  }

  if (event === "attachment_approved") {
    return (
      <div
        className={`${base} bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100`}
      >
        <CheckCircle2 className="h-5 w-5" />
      </div>
    );
  }

  if (event === "attachment_rejected") {
    return (
      <div
        className={`${base} bg-rose-50 text-rose-500 ring-1 ring-rose-100`}
      >
        <XCircle className="h-5 w-5" />
      </div>
    );
  }

  if (event === "comment_added") {
    return (
      <div
        className={`${base} bg-amber-50 text-amber-600 ring-1 ring-amber-100`}
      >
        <MessageCircle className="h-5 w-5" />
      </div>
    );
  }

  if (event === "task_due_soon") {
    return (
      <div
        className={`${base} bg-orange-50 text-orange-600 ring-1 ring-orange-100`}
      >
        <Clock3 className="h-5 w-5" />
      </div>
    );
  }

  if (event === "task_overdue") {
    return (
      <div
        className={`${base} bg-rose-50 text-rose-600 ring-1 ring-rose-100`}
      >
        <AlertTriangle className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div
      className={`${base} ${
        unread
          ? "bg-slate-900 text-amber-300 ring-1 ring-slate-800"
          : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
      }`}
    >
      <Bell className="h-5 w-5" />
    </div>
  );
}

export default function NotificationsPage() {
  const { state } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const { refreshUnreadCount, decrementUnreadCount } = useNotifications();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [meta, setMeta] = useState<NotificationsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [onlyUnread, setOnlyUnread] = useState(true);

  const loadNotifications = useCallback(
    async (options?: { background?: boolean }) => {
      if (!state?.isInitialized) return;
      if (!options?.background) {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await listMyNotifications({
          page,
          per_page: rowsPerPage,
          only_unread: onlyUnread,
        });
        setItems(res.data);
        setMeta(res.meta);
        await refreshUnreadCount();
      } catch (e: any) {
        if (!options?.background) {
          const msg = e?.message ?? "Gagal memuat notifikasi";
          setError(msg);
          showToast({
            variant: "error",
            title: "Gagal memuat notifikasi",
            description: msg,
          });
        }
      } finally {
        if (!options?.background) {
          setLoading(false);
        }
      }
    },
    [
      state?.isInitialized,
      page,
      rowsPerPage,
      onlyUnread,
      refreshUnreadCount,
      showToast,
    ]
  );

  useEffect(() => {
    if (!state?.isInitialized) return;

    let cancelled = false;

    async function run() {
      await loadNotifications();
      if (cancelled) return;
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [state?.isInitialized, loadNotifications]);

  useEffect(() => {
    if (!state?.isInitialized) return;
    if (typeof window === "undefined") return;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadNotifications({ background: true }).catch(() => {});
      }
    }, 15_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadNotifications({ background: true }).catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [state?.isInitialized, loadNotifications]);

  const total = meta?.total ?? items.length;
  const currentPage = meta?.current_page ?? page;
  const lastPage = meta?.last_page ?? 1;
  const perPage = meta?.per_page ?? rowsPerPage;

  const summary = useMemo(() => {
    if (total === 0) {
      return { from: 0, to: 0 };
    }
    const from =
      typeof meta?.from === "number" && meta.from != null
        ? meta.from
        : (currentPage - 1) * perPage + 1;
    const to =
      typeof meta?.to === "number" && meta.to != null
        ? meta.to
        : Math.min(from + items.length - 1, total);
    return { from, to };
  }, [meta?.from, meta?.to, currentPage, perPage, items.length, total]);

  const handleChangeRowsPerPage = (value: number) => {
    setRowsPerPage(value);
    setPage(1);
  };

  const handleToggleOnlyUnread = (value: boolean) => {
    setOnlyUnread(value);
    setPage(1);
  };

  const handleOpenNotification = async (n: NotificationRow) => {
    let target = "/dashboard/tasks";

    if (n.task_id != null) {
      target = `/dashboard/tasks/${n.task_id}`;
    } else if (n.entity_type === "Task" && n.entity_id != null) {
      target = `/dashboard/tasks/${n.entity_id}`;
    }

    try {
      if (!n.read_at) {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((item) =>
            item.id === n.id
              ? { ...item, read_at: new Date().toISOString() }
              : item
          )
        );
        decrementUnreadCount();
        await refreshUnreadCount();
      }
      router.push(target);
    } catch (e: any) {
      const msg = e?.message ?? "Tidak dapat membuka notifikasi";
      showToast({
        variant: "error",
        title: "Gagal membuka notifikasi",
        description: msg,
      });
    }
  };

  const hasError = !!error && !loading;

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">
          Notifications Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Ringkasan penugasan, deadline, attachment, dan komentar terbaru yang
          terkait dengan akun kamu.
        </p>
      </div>

      <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
        <div className="grid grid-cols-1 gap-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-6 md:grid-cols-2 md:items-center">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
              <Bell className="h-3.5 w-3.5" />
              <span>Notifications</span>
            </span>
            <p className="text-sm text-slate-500">
              Ringkasan penugasan, deadline, attachment, dan komentar terbaru
              yang terkait dengan akun kamu.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
              <button
                type="button"
                onClick={() => handleToggleOnlyUnread(true)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition ${
                  onlyUnread
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                <BellDot className="h-3.5 w-3.5" />
                <span>Unread only</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleOnlyUnread(false)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition ${
                  !onlyUnread
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>All</span>
              </button>
            </div>

            <RowsPerPageControl
              value={rowsPerPage}
              onChange={handleChangeRowsPerPage}
              label="Per page"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 p-6">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          </div>
        ) : hasError ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <XCircle className="h-6 w-6" />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              Gagal memuat notifikasi
            </p>
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
              <Bell className="h-6 w-6" />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              Belum ada notifikasi
            </p>
            <p className="text-xs text-slate-500">
              Kamu akan melihat update ketika ada penugasan task, deadline,
              attachment, atau komentar baru.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            <ul className="divide-y divide-slate-100">
              {items.map((n) => {
                const unread = !n.read_at;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleOpenNotification(n)}
                      className={`flex w-full items-stretch gap-4 px-6 py-4 text-left transition ${
                        unread
                          ? "bg-emerald-50/60 hover:bg-emerald-50"
                          : "hover:bg-neutral-50"
                      }`}
                    >
                      <div className="mt-1 flex-shrink-0">
                        <EventIcon event={n.event} unread={unread} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                              {n.message}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {n.actor_name && (
                                <span className="font-medium text-slate-700">
                                  {n.actor_name}
                                </span>
                              )}
                              {n.actor_name && " · "}
                              {getEventLabel(n.event)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                              {n.task_title && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                                  {n.task_title}
                                </span>
                              )}
                              {n.project_name && (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                                  {n.project_name}
                                </span>
                              )}
                              {n.due_date && (
                                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-semibold text-orange-700">
                                  Deadline {n.due_date}
                                </span>
                              )}
                              {n.entity_type && (
                                <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
                                  {n.entity_type}
                                  {n.entity_id ? ` #${n.entity_id}` : ""}
                                </span>
                              )}
                              {unread && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                                  <span className="relative flex h-2 w-2">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                  </span>
                                  Unread
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-0.5 flex flex-col items-end gap-1">
                            <span className="text-xs font-medium text-slate-400">
                              {formatDateTime(n.created_at)}
                            </span>
                            {!unread && n.read_at && (
                              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-300">
                                Read
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4 text-sm text-slate-600">
              <span>
                Showing {summary.from} to {summary.to} of {total} notification
                {total === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-1 text-slate-500">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                  onClick={() => setPage(1)}
                  disabled={currentPage === 1}
                  aria-label="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-3 text-xs font-semibold text-slate-500">
                  Page {currentPage} of {lastPage}
                </span>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                  onClick={() =>
                    setPage((p) => Math.min(lastPage, p + 1))
                  }
                  disabled={currentPage === lastPage}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold transition hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40"
                  onClick={() => setPage(lastPage)}
                  disabled={currentPage === lastPage}
                  aria-label="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
