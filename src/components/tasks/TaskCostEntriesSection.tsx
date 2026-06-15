"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createForTask,
  listByTask,
  remove,
  type TaskCostEntry,
} from "@/lib/api/cost-entries";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import IdrCurrencyInput from "@/components/ui/IdrCurrencyInput";

type Props = {
  taskId: number;
};

function toLocalISODate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatIDR(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : Number(value ?? 0);
  if (!Number.isFinite(n)) return "Rp0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function TaskCostEntriesSection({ taskId }: Props) {
  const { showToast } = useToast();
  const { loading: viewPermLoading, allowed: viewAllowed } = usePermissionGuard([
    "melihat biaya aktual",
  ]);
  const { loading: createPermLoading, allowed: createAllowed } = usePermissionGuard([
    "membuat biaya aktual",
  ]);
  const { loading: deletePermLoading, allowed: deleteAllowed } = usePermissionGuard([
    "menghapus biaya aktual",
  ]);
  const canView = !viewPermLoading && viewAllowed;
  const canCreate = !createPermLoading && createAllowed;
  const canDelete = !deletePermLoading && deleteAllowed;

  const [items, setItems] = useState<TaskCostEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [incurredOn, setIncurredOn] = useState<string>(() => toLocalISODate());
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const shiftYmd = (ymd: string, days: number): string => {
    const base = ymd ? new Date(`${ymd}T00:00:00`) : new Date();
    if (!Number.isFinite(base.getTime())) return toLocalISODate();
    base.setDate(base.getDate() + days);
    return toLocalISODate(base);
  };

  const [deleteTarget, setDeleteTarget] = useState<TaskCostEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const total = useMemo(() => {
    return (items || []).reduce((sum, it) => {
      const n =
        typeof it.amount === "string"
          ? Number(it.amount)
          : Number(it.amount ?? 0);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
  }, [items]);

  async function fetchAll() {
    if (!taskId || !canView) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listByTask(taskId);
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message ?? "Gagal memuat cost entries");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) {
      fetchAll();
    } else {
      setItems([]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, canView]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    if (!incurredOn) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      showToast({
        variant: "error",
        title: "Amount tidak valid",
        description: "Masukkan angka >= 0.",
      });
      return;
    }

    setSaving(true);
    try {
      await createForTask(taskId, {
        incurred_on: incurredOn,
        amount: amt,
        category: category.trim() || null,
        note: note.trim() || null,
      });
      setAmount("");
      setCategory("");
      setNote("");
      await fetchAll();
      showToast({
        variant: "success",
        title: "Cost entry ditambahkan",
        description: "Actual cost berhasil dicatat.",
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menambah cost entry";
      showToast({ variant: "error", title: "Gagal", description: msg });
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(taskId, deleteTarget.id);
      setDeleteTarget(null);
      await fetchAll();
      showToast({
        variant: "success",
        title: "Cost entry dihapus",
        description: "Entry berhasil dihapus.",
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal menghapus cost entry";
      showToast({ variant: "error", title: "Gagal", description: msg });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mt-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Actual Cost Entries (IDR)
          </h3>
          <p className="text-xs text-neutral-500">
            Ledger biaya aktual per task. Dipakai untuk EVM cost-based (IDR).
          </p>
        </div>
        <div className="text-xs text-neutral-600">
          Total:{" "}
          <span className="font-semibold text-slate-800">
            {formatIDR(total)}
          </span>
        </div>
      </div>

      {viewPermLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full rounded-xl bg-neutral-200/60" />
          <Skeleton className="h-9 w-full rounded-xl bg-neutral-200/60" />
        </div>
      ) : !canView ? (
        <div className="text-sm text-neutral-500">
          Anda tidak memiliki akses untuk melihat actual cost.
        </div>
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full rounded-xl bg-neutral-200/60" />
          <Skeleton className="h-9 w-full rounded-xl bg-neutral-200/60" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-neutral-500">Belum ada cost entry.</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-700">
              <tr>
                <th className="text-left font-medium px-3 py-2 border-b w-[120px]">
                  Date
                </th>
                <th className="text-left font-medium px-3 py-2 border-b w-[170px]">
                  Amount
                </th>
                <th className="text-left font-medium px-3 py-2 border-b w-[140px]">
                  Category
                </th>
                <th className="text-left font-medium px-3 py-2 border-b">
                  Note
                </th>
                {canDelete && (
                  <th className="text-right font-medium px-3 py-2 border-b w-[90px]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 border-t align-top whitespace-nowrap">
                    {it.incurred_on || "-"}
                  </td>
                  <td className="px-3 py-2 border-t align-top tabular-nums whitespace-nowrap">
                    {formatIDR(it.amount)}
                  </td>
                  <td className="px-3 py-2 border-t align-top truncate">
                    <span className="block truncate" title={it.category || ""}>
                      {it.category || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 border-t align-top">
                    <span className="block break-words whitespace-pre-wrap">
                      {it.note || "-"}
                    </span>
                  </td>
                  {canDelete && (
                    <td className="px-3 py-2 border-t align-top text-right">
                      <button
                        type="button"
                        className="text-xs text-rose-700 hover:underline disabled:opacity-50"
                        disabled={deleting}
                        onClick={() => setDeleteTarget(it)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canCreate && (
        <form onSubmit={submit} className="mt-3 grid gap-2">
          <div className="grid gap-2 md:grid-cols-3">
            <div>
              <label className="block text-xs text-neutral-600 mb-1">
                Incurred on
              </label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 text-sm"
                value={incurredOn}
                onChange={(e) => setIncurredOn(e.target.value)}
                required
              />
              <div className="mt-1 flex items-center gap-1">
                <button
                  type="button"
                  className="h-7 px-2 rounded-md border text-[11px] hover:bg-neutral-50"
                  onClick={() => setIncurredOn(toLocalISODate())}
                >
                  Today
                </button>
                <button
                  type="button"
                  className="h-7 px-2 rounded-md border text-[11px] hover:bg-neutral-50"
                  onClick={() => setIncurredOn((d) => shiftYmd(d, 1))}
                >
                  +1d
                </button>
                <button
                  type="button"
                  className="h-7 px-2 rounded-md border text-[11px] hover:bg-neutral-50"
                  onClick={() => setIncurredOn((d) => shiftYmd(d, 7))}
                >
                  +7d
                </button>
              </div>
            </div>
            <div>
              <IdrCurrencyInput
                id={`task_${taskId}_cost_amount`}
                label="Amount (IDR)"
                raw={amount}
                onRawChange={setAmount}
                required
                placeholder="0"
                labelClassName="block text-xs text-neutral-600 mb-1"
                inputClassName="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-600 mb-1">
                Category
              </label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="(optional)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-600 mb-1">Note</label>
            <textarea
              className="w-full border rounded-md px-3 py-2 text-sm min-h-[72px]"
              placeholder="(optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex h-9 min-w-[160px] items-center justify-center rounded-full border border-[#00674F] bg-[#00674F] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#005341] disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "Saving..." : "Add entry"}
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus cost entry?"
        description={
          deleteTarget
            ? `Hapus entry ${deleteTarget.incurred_on} sebesar ${formatIDR(
                deleteTarget.amount
              )}?`
            : ""
        }
        confirmLabel={deleting ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          void doDelete();
        }}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </section>
  );
}
