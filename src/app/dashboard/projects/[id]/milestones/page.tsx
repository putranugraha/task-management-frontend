"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DataTable from "../../../users/data-table";
import { listByProject, remove, complete } from "@/lib/api/milestones";
import { listByProject as listTasksByProject } from "@/lib/api/tasks";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";
import { useMilestoneColumns, type MilestoneRow } from "./columns";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";

function ProjectMilestonesPageContent() {
  const params = useParams();
  const projectId = params?.id as string;
  const { can } = useAuth();
  const canCreateProject = can("membuat project");
  const canUpdateProject = can("mengubah project");
  const canDeleteProject = can("menghapus project");
  const canCreateTasks = can("membuat tugas");
  const { showToast } = useToast();

  const [rows, setRows] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Project Tasks state
  type TaskRow = {
    id: number;
    title: string;
    milestone?: { id: number; name: string } | null;
    priority: string;
    status: string;
    percent_complete: number;
  };
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [projectTasksFull, setProjectTasksFull] = useState<Task[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MilestoneRow | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<MilestoneRow | null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listByProject(projectId);
      // Sort raw milestones to keep order stable even when status changes
      const sorted: Milestone[] = [...list].sort((a, b) => {
        const da = a.due_planned ? Date.parse(a.due_planned) : Number.POSITIVE_INFINITY;
        const db = b.due_planned ? Date.parse(b.due_planned) : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        const ca = a.created_at ? Date.parse(a.created_at) : 0;
        const cb = b.created_at ? Date.parse(b.created_at) : 0;
        if (ca !== cb) return ca - cb;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const mapped: MilestoneRow[] = sorted.map((m: Milestone) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        due_planned: m.due_planned,
        due_actual: (m as any).due_actual ?? null,
        project: m.project ?? undefined,
      }));
      setRows(mapped);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load milestones";
      setError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat milestones",
        description: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTasks = async () => {
    if (!projectId) return;
    try {
      setTaskLoading(true);
      setTaskError(null);
      const list = await listTasksByProject(projectId);
      // Stabilize order: by status group then created_at/id
      const sorted: Task[] = [...list].sort((a, b) => {
        const sa = a.status || '';
        const sb = b.status || '';
        if (sa !== sb) return sa.localeCompare(sb);
        const ca = a.created_at ? Date.parse(a.created_at) : 0;
        const cb = b.created_at ? Date.parse(b.created_at) : 0;
        if (ca !== cb) return ca - cb;
        return (a.id ?? 0) - (b.id ?? 0);
      });
      const mapped: TaskRow[] = sorted.map((t: Task) => ({
        id: t.id,
        title: t.title,
        milestone: t.milestone ?? (t.milestone_id ? { id: t.milestone_id, name: '-' } : null),
        priority: t.priority,
        status: t.status,
        percent_complete: t.percent_complete ?? 0,
      }));
      setTaskRows(mapped);
      setProjectTasksFull(sorted);
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load project tasks";
      setTaskError(msg);
      showToast({
        variant: "error",
        title: "Gagal memuat tasks proyek",
        description: msg,
      });
    } finally {
      setTaskLoading(false);
    }
  };

  useEffect(() => { if (projectId) { fetchList(); fetchProjectTasks(); } }, [projectId]);

  const handleArchive = (row: MilestoneRow) => {
    setArchiveTarget(row);
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    setArchiveLoading(true);
    try {
      await remove(archiveTarget.id);
      await fetchList();
      showToast({
        variant: "success",
        title: "Milestone di-archive",
        description: `Milestone "${archiveTarget.name}" berhasil dipindahkan ke archive.`,
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal archive milestone";
      showToast({
        variant: "error",
        title: "Gagal archive milestone",
        description: msg,
      });
    } finally {
      setArchiveLoading(false);
      setArchiveTarget(null);
    }
  };

  const handleComplete = (row: MilestoneRow) => {
    setCompleteTarget(row);
  };

  const confirmComplete = async () => {
    if (!completeTarget) return;
    try {
      setCompleteLoading(true);
      const tasks = projectTasksFull.filter(
        (t) => (t.milestone?.id ?? t.milestone_id) === completeTarget.id
      );
      let candidate: string | null = null;
      const actuals = tasks.map((t: any) => t.end_actual).filter(Boolean) as string[];
      if (actuals.length) {
        candidate = actuals.sort((a,b) => Date.parse(b)-Date.parse(a))[0];
      } else {
        const planned = tasks.map(t => t.end_planned).filter(Boolean) as string[];
        if (planned.length) candidate = planned.sort((a,b) => Date.parse(b)-Date.parse(a))[0];
      }
      await complete(completeTarget.id);
      await fetchList();
      await fetchProjectTasks();
      showToast({
        variant: "success",
        title: "Milestone completed",
        description: candidate
          ? `Milestone "${completeTarget.name}" ditandai selesai (actual: ${candidate}).`
          : `Milestone "${completeTarget.name}" ditandai selesai.`,
      });
    } catch (e: any) {
      const msg = e?.message ?? "Failed to complete milestone";
      showToast({
        variant: "error",
        title: "Gagal menyelesaikan milestone",
        description: msg,
      });
    } finally {
      setCompleteLoading(false);
      setCompleteTarget(null);
    }
  };

  const columns = useMilestoneColumns({
    onDelete: handleArchive,
    onComplete: handleComplete,
    canEdit: canUpdateProject,
    canDelete: canDeleteProject,
  });

  const activeTasksCountForTarget =
    completeTarget && projectTasksFull.length > 0
      ? projectTasksFull
          .filter(
            (t) => (t.milestone?.id ?? t.milestone_id) === completeTarget.id
          )
          .filter((t) => {
            const s = String(t.status ?? "").toLowerCase();
            const isDoneLike =
              s.includes("done") ||
              s.includes("complete") ||
              s.includes("selesai");
            const isCancelled = s.includes("cancel");
            return !(isDoneLike || isCancelled);
          }).length
      : 0;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href={`/dashboard/projects/${projectId}`}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#00674F] hover:text-[#008061]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00674F]/10 text-[#00674F]">
              ←
            </span>
            Back to Project
          </Link>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">
            Project Milestones
          </h1>
          <p className="text-sm text-slate-500">
            Kelola milestones dan tasks yang terkait dalam project ini.
          </p>
        </div>
        {(canCreateProject || canDeleteProject) && (
          <div className="flex flex-wrap items-center gap-2">
            {canDeleteProject && (
              <Link
                href={`/dashboard/milestones/archive?project_id=${projectId}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
              >
                Archive
              </Link>
            )}
            {canCreateProject && (
              <Link
                href={`/dashboard/projects/${projectId}/milestones/create`}
                className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061]"
              >
                Create Milestone
              </Link>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Milestones
            </h2>
            <p className="text-xs text-slate-400">
              Daftar milestones untuk project ini beserta statusnya.
            </p>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : (
            <DataTable columns={columns as any} data={rows} loading={loading} />
          )}
        </div>
      </div>

      <div className="rounded-[32px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-6 py-4 gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Project Tasks
            </h2>
            <p className="text-xs text-slate-400">
              Tasks dalam project ini beserta milestone yang terkait.
            </p>
          </div>
          {canCreateTasks && (
            <Link
              href={`/dashboard/tasks/create?project_id=${projectId}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-4 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-[#008061]"
            >
              Create Task
            </Link>
          )}
        </div>
        {taskError && (
          <div className="px-6 pt-3 text-sm text-red-600">{taskError}</div>
        )}
        <div className="p-6">
          {taskLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : (
            <DataTable
              columns={[
                { key: "title", header: "Title" },
                {
                  key: "milestone",
                  header: "Milestone",
                  render: (r: TaskRow) => r.milestone?.name ?? "-",
                },
                { key: "priority", header: "Priority" },
                { key: "status", header: "Status" },
                {
                  key: "percent_complete",
                  header: "%",
                  render: (r: TaskRow) => `${r.percent_complete ?? 0}%`,
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (r: TaskRow) => (
                    <div className="flex justify-end gap-2 text-sm">
                      {canCreateTasks && (
                        <a
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-[#00674F] hover:text-[#00674F]"
                          href={`/dashboard/tasks/${r.id}/edit`}
                        >
                          Edit
                        </a>
                      )}
                    </div>
                  ),
                },
              ] as any}
              data={taskRows}
              loading={taskLoading}
              emptyText="No tasks in this project"
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!archiveTarget}
        title="Archive milestone ini?"
        description={
          archiveTarget
            ? `Milestone "${archiveTarget.name}" akan dipindahkan ke archive dan bisa di-restore nanti.`
            : ""
        }
        confirmLabel="Archive"
        cancelLabel="Batal"
        variant="danger"
        loading={archiveLoading}
        onConfirm={confirmArchive}
        onCancel={() => !archiveLoading && setArchiveTarget(null)}
      />

      <ConfirmDialog
        open={!!completeTarget}
        title="Selesaikan milestone ini?"
        description={
          completeTarget
            ? activeTasksCountForTarget > 0
              ? `Milestone "${completeTarget.name}" akan ditandai sebagai completed. Peringatan: masih ada ${activeTasksCountForTarget} task terkait yang statusnya belum selesai (bukan Done/Completed/Cancelled). Lanjutkan?`
              : `Milestone "${completeTarget.name}" akan ditandai sebagai completed. Pastikan semua tasks terkait sudah selesai.`
            : ""
        }
        confirmLabel="Mark as Completed"
        cancelLabel="Batal"
        variant="default"
        loading={completeLoading}
        onConfirm={confirmComplete}
        onCancel={() => !completeLoading && setCompleteTarget(null)}
      />
    </div>
  );
}

export default function ProjectMilestonesPage() {
  const { loading, allowed } = usePermissionGuard(["melihat project"]);

  if (!loading && !allowed) {
    return <Forbidden />;
  }

  if (loading) {
    return null;
  }

  return <ProjectMilestonesPageContent />;
}
