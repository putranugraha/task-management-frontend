"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { getById as getMilestoneById } from "@/lib/api/milestones";
import { listByMilestone, createForMilestone, remove as deleteTask } from "@/lib/api/tasks";
import type { Milestone } from "@/types/milestone";
import type { Task } from "@/types/task";
import DataTable from "@/app/dashboard/users/data-table";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DetailMainCard, DetailSectionCard } from "@/components/layout/DetailCards";
import { Skeleton } from "@/components/ui/skeleton";

type TaskRow = Pick<Task, 'id' | 'title' | 'status' | 'start_planned' | 'end_planned' | 'percent_complete'>;

export default function MilestoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const { can } = useAuth();
  const canCreateTasks = can("membuat tugas");
  const canUpdateTasks = can("mengubah tugas");
  const canDeleteTasks = can("menghapus tugas");
  const { showToast } = useToast();

  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [tLoading, setTLoading] = useState(false);
  const [tError, setTError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newTask, setNewTask] = useState({ title: "", status: "To Do", priority: "Medium", start_planned: "", end_planned: "", percent_complete: 0 });

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const m = await getMilestoneById(id);
        if (mounted) setMilestone(m);
      } catch (e: any) {
        const s = e?.response?.status;
        if (s === 404) setError('Milestone not found'); else setError(e?.message ?? 'Failed to load milestone');
      } finally {
        setLoading(false);
      }
    }
    if (id) run();
    return () => { mounted = false; };
  }, [id]);

  const fetchTasks = async () => {
    try {
      setTLoading(true);
      setTError(null);
      const list = await listByMilestone(id);
      // Sorting: due_planned asc (null last) -> created_at asc -> id asc
      const sorted = [...list].sort((a, b) => {
        const da = a.start_planned ? Date.parse(a.start_planned) : Number.POSITIVE_INFINITY;
        const db = b.start_planned ? Date.parse(b.start_planned) : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        const ca = a.created_at ? Date.parse(a.created_at) : 0;
        const cb = b.created_at ? Date.parse(b.created_at) : 0;
        if (ca !== cb) return ca - cb;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const mapped: TaskRow[] = sorted.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        start_planned: t.start_planned,
        end_planned: t.end_planned,
        percent_complete: Number(t.percent_complete ?? 0),
      }));
      setTasks(mapped);
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to load tasks';
      setTError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat tasks",
        description: msg,
      });
    } finally {
      setTLoading(false);
    }
  };

  useEffect(() => { if (id) fetchTasks(); }, [id]);

  const onCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalErr(null);
    try {
      if (!newTask.title) { setModalErr('Title is required'); setSaving(false); return; }
      if (!newTask.priority) { setModalErr('Priority is required'); setSaving(false); return; }
      if (newTask.percent_complete < 0 || newTask.percent_complete > 100) { setModalErr('Percent must be 0-100'); setSaving(false); return; }
      const projectIdForTask = (milestone as any)?.project_id ?? milestone?.project?.id;
      if (!projectIdForTask) {
        setModalErr('Project id is missing for this milestone');
        setSaving(false);
        return;
      }
      await createForMilestone(id, {
        title: newTask.title,
        status: newTask.status,
        priority: newTask.priority,
        start_planned: newTask.start_planned || null,
        end_planned: newTask.end_planned || null,
        percent_complete: Number(newTask.percent_complete ?? 0),
        project_id: Number(projectIdForTask),
      });
      setModalOpen(false);
      setNewTask({ title: "", status: "To Do", priority: "Medium", start_planned: "", end_planned: "", percent_complete: 0 });
      await fetchTasks();
      showToast({
        variant: "success",
        title: "Task dibuat",
        description: `Task "${newTask.title}" berhasil dibuat pada milestone ini.`,
      });
    } catch (e: any) {
      const errors = e?.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        const firstKey = Object.keys(errors)[0];
        const val = errors[firstKey];
        setModalErr(Array.isArray(val) ? val.join(', ') : String(val ?? 'Invalid'));
      } else if (e?.response?.status === 404) {
        setModalErr('Milestone not found');
      } else if (e?.response?.status === 401 || e?.response?.status === 403) {
        setModalErr('Not authorized to perform this action');
      } else {
        const msg = e?.message ?? 'Failed to create task';
        setModalErr(msg);
        showToast({
          variant: "error",
          title: "Gagal membuat task",
          description: msg,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(() => {
    return [
      { key: "title", header: "Title" },
      { key: "status", header: "Status" },
      {
        key: "start_planned",
        header: "Start",
        render: (r: TaskRow) => r.start_planned ?? "-",
      },
      {
        key: "end_planned",
        header: "End",
        render: (r: TaskRow) => r.end_planned ?? "-",
      },
      {
        key: "percent_complete",
        header: "%",
        render: (r: TaskRow) => `${r.percent_complete}%`,
      },
      {
        key: "actions",
        header: "Actions",
        render: (row: TaskRow) => (
          <TaskActions
            row={row}
            onChanged={fetchTasks}
            canEdit={canUpdateTasks}
            canDelete={canDeleteTasks}
          />
        ),
      },
    ] as any;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUpdateTasks, canDeleteTasks]);
  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div className="px-1">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/milestones">Milestones</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Loading…</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <DetailMainCard>
          <div className="space-y-3">
            <Skeleton className="h-7 w-64 rounded-md" />
            <Skeleton className="h-4 w-40 rounded-md" />
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 mt-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        </DetailMainCard>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  if (!milestone) {
    return <div className="text-neutral-500">No milestone</div>;
  }

  return (
    <div className="w-full space-y-6">
      <div className="px-1">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/milestones">Milestones</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{milestone.name ?? `Milestone #${id}`}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <DetailMainCard className="w-full">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900 truncate">
              {milestone.name}
            </h1>
            <p className="text-sm text-slate-500">
              {milestone.project?.name
                ? `Project: ${milestone.project.name}`
                : "Milestone detail overview"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#00674F]/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#00674F]">
              {milestone.status}
            </span>
            {milestone.due_planned && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                Due {milestone.due_planned}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 grid-cols-1 md:grid-cols-2">
          <InfoRow
            label="Project"
            value={milestone.project?.name ?? milestone.project_id ?? "-"}
          />
          <InfoRow label="Status" value={milestone.status ?? "-"} />
          <InfoRow
            label="Due Planned"
            value={milestone.due_planned ?? "-"}
          />
          <InfoRow label="Due Actual" value={milestone.due_actual ?? "-"} />
          <InfoRow label="Created At" value={milestone.created_at ?? "-"} />
          <InfoRow label="Updated At" value={milestone.updated_at ?? "-"} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {milestone.project?.id && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/dashboard/projects/${milestone.project?.id}/milestones`
                )
              }
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
            >
              View project milestones
            </button>
          )}
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Back
          </button>
        </div>
      </DetailMainCard>

      <DetailSectionCard>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-800">Tasks</h3>
          {canCreateTasks && (
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
            >
              Add Task
            </button>
          )}
        </div>
        <div className="border rounded-lg overflow-hidden">
          <DataTable columns={columns} data={tasks} loading={tLoading} />
        </div>
        {tError && <div className="mt-2 text-sm text-red-600">{tError}</div>}
      </DetailSectionCard>

      {modalOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={() => !saving && setModalOpen(false)}
              />
              <div className="relative z-10 w-full max-w-lg transform rounded-3xl bg-white/95 p-6 shadow-[0_24px_48px_rgba(15,23,42,0.22)] ring-1 ring-slate-100 animate-[fade-in-down_0.22s_ease-out]">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Create Task
                    </p>
                    <h2 className="text-base font-semibold text-slate-900">
                      Tambahkan task baru untuk milestone ini
                    </h2>
                    {modalErr && (
                      <p className="mt-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                        {modalErr}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={saving}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                    aria-label="Close"
                  >
                    <span className="text-lg leading-none">&times;</span>
                  </button>
                </div>

                <form onSubmit={onCreateTask} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-600 mb-1">
                      Title
                    </label>
                    <input
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                      value={newTask.title}
                      onChange={(e) =>
                        setNewTask((s) => ({ ...s, title: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1">
                        Status
                      </label>
                      <select
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                        value={newTask.status}
                        onChange={(e) =>
                          setNewTask((s) => ({
                            ...s,
                            status: e.target.value,
                          }))
                        }
                      >
                        <option>To Do</option>
                        <option>In Progress</option>
                        <option>Done</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1">
                        Priority
                      </label>
                      <select
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                        value={newTask.priority}
                        onChange={(e) =>
                          setNewTask((s) => ({
                            ...s,
                            priority: e.target.value,
                          }))
                        }
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1">
                        Percent
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                        value={newTask.percent_complete}
                        onChange={(e) =>
                          setNewTask((s) => ({
                            ...s,
                            percent_complete: Number(e.target.value || 0),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1">
                        Start Planned
                      </label>
                      <input
                        type="date"
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                        value={newTask.start_planned}
                        onChange={(e) =>
                          setNewTask((s) => ({
                            ...s,
                            start_planned: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-600 mb-1">
                        End Planned
                      </label>
                      <input
                        type="date"
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 shadow-inner transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                        value={newTask.end_planned}
                        onChange={(e) =>
                          setNewTask((s) => ({
                            ...s,
                            end_planned: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 transition hover:border-slate-300 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60"
                    >
                      {saving && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {saving ? "Saving" : "Save Task"}
                    </button>
                  </div>
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="min-h-[40px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-inner flex items-center">
        <span className="truncate w-full whitespace-nowrap">{value}</span>
      </div>
    </div>
  );
}

function TaskActions({
  row,
  onChanged,
  canEdit,
  canDelete,
}: {
  row: TaskRow;
  onChanged: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);

  
  const doDelete = async () => {
    if (!deleteOpen) {
      setDeleteOpen(true);
      return;
    }
    try {
      setSaving(true);
      await deleteTask(row.id);
      onChanged();
      showToast({
        variant: "success",
        title: "Task dihapus",
        description: `Task "${row.title}" berhasil dihapus.`,
      });
    } catch (e: any) {
      const msg = e?.message ?? 'Failed';
      showToast({
        variant: "error",
        title: "Gagal menghapus task",
        description: msg,
      });
    } finally {
      setSaving(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm"
        href={`/dashboard/tasks/${row.id}`}
      >
        Detail
      </a>
      {(canEdit || canDelete) && (
        <>
          {canEdit && (
          <a
            className="px-2 py-1 rounded-md border hover:bg-neutral-50 text-sm"
            href={`/dashboard/tasks/${row.id}/edit`}
          >
            Edit
          </a>
          )}
          {canDelete && (
          <button
            className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50 text-sm"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </button>
          )}
          <ConfirmDialog
            open={deleteOpen}
            title="Hapus task ini?"
            description={`Task "${row.title}" akan dihapus dari milestone ini.`}
            confirmLabel="Hapus"
            cancelLabel="Batal"
            variant="danger"
            loading={saving}
            onConfirm={doDelete}
            onCancel={() => !saving && setDeleteOpen(false)}
          />
        </>
      )}
    </div>
  );
}
