"use client";

import { useEffect, useState } from "react";
import {
  listByTask,
  uploadForTask,
  approveAttachment,
  rejectAttachment,
  type TaskAttachment,
} from "@/lib/api/task-attachments";
import { saveProgress, complete } from "@/lib/api/tasks";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Paperclip, UploadCloud } from "lucide-react";

const MAX_ATTACHMENT_SIZE_MB = 20;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

type Props = {
  taskId: number;
  initialPercent?: number;
  onPercentChange?: (value: number) => void;
  onStatusChange?: (value: string) => void;
};

export default function TaskAttachmentsSection({
  taskId,
  initialPercent,
  onPercentChange,
  onStatusChange,
}: Props) {
  const [items, setItems] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { loading: uploadPermLoading, allowed: uploadAllowed } = usePermissionGuard([
    "membuat lampiran",
  ]);
  const { loading: moderatePermLoading, allowed: moderateAllowed } = usePermissionGuard([
    "mengubah lampiran",
  ]);
  const canUpload = uploadAllowed && !uploadPermLoading;
  const canModerate = !moderatePermLoading && moderateAllowed;
  const { showToast } = useToast();
  const [moderateTarget, setModerateTarget] = useState<{
    id: number;
    action: "approve" | "reject";
    filename?: string | null;
  } | null>(null);
  const [moderateLoading, setModerateLoading] = useState(false);
  const [progressMode, setProgressMode] = useState<
    "none" | "complete" | "custom"
  >("complete");
  const initialPctNumber = Number.isFinite(initialPercent ?? 0)
    ? Number(initialPercent ?? 0)
    : 0;
  const [progressValue, setProgressValue] = useState<number>(initialPctNumber);
  const [progressInput, setProgressInput] = useState<string>(
    String(initialPctNumber)
  );
  useEffect(() => {
    if (typeof initialPercent === "number" && Number.isFinite(initialPercent)) {
      const pct = Math.max(0, Math.min(100, Number(initialPercent)));
      setProgressValue(pct);
      setProgressInput(String(pct));
    }
  }, [initialPercent]);

  async function fetchAttachments() {
    setLoading(true);
    setError(null);
    try {
      const list = await listByTask(taskId);
      setItems(list);
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
        // Untuk timeout, treat sebagai tidak ada lampiran supaya UI tetap bersih.
        setItems([]);
        setError(null);
      } else {
        setError(e?.message ?? "Gagal memuat lampiran");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!taskId) return;
    fetchAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      showToast({
        variant: "error",
        title: "File belum dipilih",
        description: "Pilih file terlebih dahulu sebelum mengunggah lampiran.",
      });
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      showToast({
        variant: "error",
        title: "Ukuran file terlalu besar",
        description: `Maksimal ukuran attachment adalah ${MAX_ATTACHMENT_SIZE_MB} MB. File ini ${formatFileSize(file.size)}.`,
      });
      return;
    }

    const filename = file.name;
    setUploading(true);
    try {
      await uploadForTask(taskId, file);
      setFile(null);
      showToast({
        variant: "success",
        title: "Lampiran berhasil diupload",
        description: filename
          ? `${filename} berhasil ditambahkan dan menunggu review.`
          : "Lampiran berhasil ditambahkan dan menunggu review.",
      });
      await fetchAttachments();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal upload lampiran";
      showToast({
        variant: "error",
        title: "Gagal upload lampiran",
        description: msg,
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleStatus(id: number, action: "approve" | "reject") {
    try {
      setModerateLoading(true);
      const target = items.find((i) => i.id === id);
      if (!target) {
        showToast({
          variant: "error",
          title: "Lampiran tidak ditemukan",
          description: "Lampiran mungkin sudah dihapus atau tidak tersedia.",
        });
        return;
      }
      const currentStatus = String(target.status || "").toLowerCase();
      if (currentStatus !== "pending") {
        showToast({
          variant: "warning",
          title: "Aksi tidak dapat dilakukan",
          description: "Lampiran ini sudah tidak berstatus pending.",
        });
        return;
      }

      if (action === "approve") {
        await approveAttachment(id);

        // Setelah lampiran disetujui, tawarkan update progres task jika diminta.
        if (progressMode === "complete") {
          try {
            const updated = await complete(taskId);
            const pct = Number((updated as any)?.percent_complete ?? 100);
            if (Number.isFinite(pct)) {
              onPercentChange?.(pct);
            } else {
              onPercentChange?.(100);
            }
            const status = (updated as any)?.status;
            if (status) {
              onStatusChange?.(String(status));
            }
          } catch (e: any) {
            const msg =
              e?.response?.data?.message ||
              e?.response?.data?.error ||
              e?.message ||
              "Gagal menandai task sebagai selesai";
            showToast({
              variant: "error",
              title: "Gagal update progres task",
              description: msg,
            });
          }
        } else if (progressMode === "custom") {
          const raw = Number(progressValue ?? initialPercent ?? 0);
          const pct = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
          try {
            const updated = await saveProgress(
              taskId,
              pct
            );
            const latest = Number((updated as any)?.percent_complete ?? pct);
            onPercentChange?.(
              Number.isFinite(latest) ? latest : pct
            );
          } catch (e: any) {
            const msg =
              e?.response?.data?.message ||
              e?.response?.data?.error ||
              e?.message ||
              "Gagal memperbarui progres task";
            showToast({
              variant: "error",
              title: "Gagal update progres task",
              description: msg,
            });
          }
        }
      } else {
        await rejectAttachment(id);
      }
      await fetchAttachments();
      showToast({
        variant: "success",
        title: action === "approve" ? "Lampiran disetujui" : "Lampiran ditolak",
        description:
          action === "approve"
            ? "Status lampiran berhasil diubah menjadi Approved."
            : "Status lampiran berhasil diubah menjadi Rejected.",
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal mengubah status lampiran";
      showToast({
        variant: "error",
        title: "Gagal mengubah status lampiran",
        description: msg,
      });
    } finally {
      setModerateLoading(false);
      setModerateTarget(null);
    }
  }

  const badgeClasses = (status: TaskAttachment["status"]) => {
    const s = String(status || "").toLowerCase();
    if (s === "approved") return "bg-[#00674F]/10 text-[#00674F]";
    if (s === "rejected") return "bg-rose-50 text-rose-700";
    return "bg-amber-50 text-amber-700";
  };

  return (
    <section className="mt-4">
      <h3 className="text-sm font-semibold mb-2 text-slate-800">
        Attachments
      </h3>
      <div className="border rounded-lg bg-white/60">
        {loading ? (
          <div className="p-3 space-y-3">
            <Skeleton className="h-4 w-40 rounded" />
            {[...Array(2)].map((_, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-2">
                <Skeleton className="h-4 w-40 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-3 text-sm text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="p-3 text-sm text-neutral-500">
            Belum ada lampiran untuk task ini.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <th className="text-left font-medium px-3 py-2 border-b">File</th>
                <th className="text-left font-medium px-3 py-2 border-b">Status</th>
                <th className="text-left font-medium px-3 py-2 border-b">Uploaded</th>
                <th className="text-left font-medium px-3 py-2 border-b">Size</th>
                {canModerate && (
                  <th className="text-left font-medium px-3 py-2 border-b">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((a) => {
                const status = String(a.status || "");
                const isPending = status.toLowerCase() === "pending";
                return (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 border-t align-top">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-slate-800 hover:text-[#00674F] hover:underline break-all"
                      >
                        {a.filename}
                      </a>
                      <div className="mt-1 text-[11px] text-neutral-500">
                        ID: {a.id} · Task #{a.entity_id}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-t align-top">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClasses(
                          a.status
                        )}`}
                      >
                        {status || "Pending"}
                      </span>
                      {a.verified_by?.name && (
                        <div className="mt-1 text-[11px] text-neutral-500">
                          by {a.verified_by.name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 border-t align-top">
                      <div className="text-xs text-slate-700">
                        {a.uploaded_at ?? a.verified_at ?? "-"}
                      </div>
                    </td>
                    <td className="px-3 py-2 border-t align-top">
                      {a.size ? `${(a.size / 1024).toFixed(1)} KB` : "-"}
                    </td>
                    {canModerate && (
                      <td className="px-3 py-2 border-t align-top">
                        {isPending ? (
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setModerateTarget({
                                  id: a.id,
                                  action: "approve",
                                  filename: a.filename,
                                })
                              }
                              className="inline-flex items-center justify-center px-3 py-1.5 rounded-full border border-[#00674F] bg-[#00674F]/5 text-xs font-semibold text-[#00674F] hover:bg-[#00674F]/10 hover:border-[#00674F] transition min-w-[96px]"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModerateTarget({
                                  id: a.id,
                                  action: "reject",
                                  filename: a.filename,
                                })
                              }
                              className="inline-flex items-center justify-center px-3 py-1.5 rounded-full border border-rose-300 bg-rose-50 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:border-rose-400 transition min-w-[96px]"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-[11px] text-slate-600">
                            Tidak ada aksi
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {canUpload && (
        <form
          onSubmit={handleUpload}
          className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-sm flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="task-attachment-file"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm cursor-pointer transition hover:border-[#00674F] hover:text-[#00674F]"
            >
              <Paperclip className="h-4 w-4" />
              <span>Pilih file</span>
            </label>
            {file && (
              <span className="max-w-[320px] truncate text-xs text-slate-600">
                {file.name} ({formatFileSize(file.size)})
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-neutral-500">
              Upload lampiran yang relevan. Maksimal {MAX_ATTACHMENT_SIZE_MB} MB per file.
            </p>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex items-center justify-center rounded-full border border-[#00674F] bg-[#00674F] px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#005341] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadCloud className="mr-1.5 h-4 w-4" />
              {uploading ? "Mengunggah..." : "Upload"}
            </button>
          </div>
          <input
            id="task-attachment-file"
            type="file"
            onChange={(e) => {
              const selected = e.target.files?.[0] ?? null;
              if (selected && selected.size > MAX_ATTACHMENT_SIZE_BYTES) {
                showToast({
                  variant: "error",
                  title: "Ukuran file terlalu besar",
                  description: `Maksimal ukuran attachment adalah ${MAX_ATTACHMENT_SIZE_MB} MB. File ini ${formatFileSize(selected.size)}.`,
                });
                e.currentTarget.value = "";
                setFile(null);
                return;
              }
              setFile(selected);
            }}
            className="sr-only"
          />
        </form>
      )}

      <ConfirmDialog
        open={!!moderateTarget}
        title={
          moderateTarget?.action === "approve"
            ? "Setujui lampiran ini?"
            : "Tolak lampiran ini?"
        }
        description={
          moderateTarget
            ? `Lampiran "${moderateTarget.filename ?? moderateTarget.id}" akan diubah statusnya menjadi "${moderateTarget.action === "approve" ? "Approved" : "Rejected"}".`
            : ""
        }
        confirmLabel={moderateTarget?.action === "approve" ? "Setujui" : "Tolak"}
        cancelLabel="Batal"
        variant={moderateTarget?.action === "reject" ? "danger" : "default"}
        loading={moderateLoading}
        onConfirm={() =>
          moderateTarget && handleStatus(moderateTarget.id, moderateTarget.action)
        }
        onCancel={() => !moderateLoading && setModerateTarget(null)}
      >
        {moderateTarget?.action === "approve" && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500">
              Setelah lampiran disetujui, kamu bisa langsung mengatur progres task berdasarkan hasil review.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  className="h-3.5 w-3.5 text-[#00674F]"
                  checked={progressMode === "complete"}
                  onChange={() => setProgressMode("complete")}
                />
                <span>
                  Tandai task sebagai <span className="font-semibold">selesai (100%)</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  className="mt-1 h-3.5 w-3.5 text-[#00674F]"
                  checked={progressMode === "custom"}
                  onChange={() => setProgressMode("custom")}
                />
                <span className="flex-1 space-y-1">
                  <span>Atur progres secara bertahap:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={progressInput}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setProgressInput("");
                          setProgressValue(0);
                          return;
                        }
                        const digitsOnly = raw.replace(/\D/g, "");
                        const num = Math.max(
                          0,
                          Math.min(100, Number(digitsOnly || "0"))
                        );
                        setProgressValue(num);
                        setProgressInput(String(num));
                      }}
                      className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                    />
                    <span className="text-sm text-slate-600">%</span>
                    {typeof initialPercent === "number" && (
                      <span className="ml-2 text-[11px] text-neutral-500">
                        Progress saat ini:{" "}
                        <span className="font-semibold">
                          {initialPercent}%
                        </span>
                      </span>
                    )}
                  </div>
                </span>
              </label>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </section>
  );
}
