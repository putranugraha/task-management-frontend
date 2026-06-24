"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { createForProject, MILESTONE_STATUS_OPTIONS, type CreateMilestoneDto, listByProject as listMilestonesByProject } from "@/lib/api/milestones";
import { createForMilestone as createTaskForMilestone } from "@/lib/api/tasks";
import { apiRequest } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import Forbidden from "@/components/auth/Forbidden";
import { useToast } from "@/components/ui/toast";
import IdrCurrencyInput from "@/components/ui/IdrCurrencyInput";
import TaskDependencyEditor from "@/components/tasks/TaskDependencyEditor";

const TASK_STATUS_OPTIONS = ["To Do", "In Progress", "Done", "On Hold", "Cancelled"] as const;
const TASK_PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"] as const;
// Distinct accent colors to differentiate task cards
const TASK_CARD_COLORS = [
  '#059669', // emerald-600
  '#0ea5e9', // sky-500
  '#6366f1', // indigo-500
  '#f59e0b', // amber-500
  '#f43f5e', // rose-500
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#84cc16', // lime-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
] as const;

type FormState = {
  name: string;
  status: string;
  due_planned: string;
  due_actual: string;
};

type FieldErrors = Partial<Record<keyof CreateMilestoneDto, string>> & { [k: string]: string };

type AssignmentUser = {
  id: number;
  name: string;
  role: string | null;
  roles: string[];
  division: { id: number; name: string; code?: string | null } | null;
};

type AssignmentUserGroup = {
  key: string;
  name: string;
  users: AssignmentUser[];
};

type RawAssignmentDivision = {
  id?: unknown;
  division_id?: unknown;
  name?: unknown;
  division_name?: unknown;
  title?: unknown;
  code?: unknown;
};

type RawAssignmentRole = string | { name?: unknown };

type RawAssignmentUser = {
  id?: unknown;
  user_id?: unknown;
  value?: unknown;
  key?: unknown;
  name?: unknown;
  full_name?: unknown;
  username?: unknown;
  email?: unknown;
  role?: unknown;
  roles?: RawAssignmentRole[];
  division?: RawAssignmentDivision | null;
  department?: RawAssignmentDivision | null;
};

function normalizeUserRole(user: Pick<RawAssignmentUser, "role" | "roles">): string | null {
  if (typeof user?.role === "string" && user.role.trim()) return user.role.trim();
  if (Array.isArray(user?.roles) && user.roles.length > 0) {
    const first = user.roles[0];
    const role = typeof first === "string" ? first : first?.name;
    return typeof role === "string" && role.trim() ? role.trim() : null;
  }
  return null;
}

function groupAssignmentUsers(users: AssignmentUser[]): AssignmentUserGroup[] {
  const groups = new Map<string, AssignmentUserGroup>();

  users.forEach((user) => {
    const divisionName = user.division?.name?.trim() || (user.role?.toLowerCase().includes("admin") ? "Admin" : "Tanpa Divisi");
    const key = user.division?.id ? `division-${user.division.id}` : `no-division-${divisionName.toLowerCase()}`;

    if (!groups.has(key)) {
      groups.set(key, { key, name: divisionName, users: [] });
    }
    groups.get(key)?.users.push(user);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      users: group.users.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => {
      if (a.name === "Tanpa Divisi") return 1;
      if (b.name === "Tanpa Divisi") return -1;
      if (a.name === "Admin") return -1;
      if (b.name === "Admin") return 1;
      return a.name.localeCompare(b.name);
    });
}

function toDateOnly(value: unknown) {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function minDateString(...dates: Array<string | undefined | null>) {
  const validDates = dates.map(toDateOnly).filter((date): date is string => Boolean(date));
  if (!validDates.length) return undefined;
  return validDates.sort((a, b) => Date.parse(a) - Date.parse(b))[0];
}

function CreateProjectMilestonePageContent() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [form, setForm] = useState<FormState>({
    name: "",
    status: "Planned",
    due_planned: "",
    due_actual: "",
  });
  const [projectPlannedStart, setProjectPlannedStart] = useState<string>("");
  const [projectPlannedEnd, setProjectPlannedEnd] = useState<string>("");
  const milestoneDueMax = minDateString(form.due_planned, projectPlannedEnd);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Users for task assignments
  const [users, setUsers] = useState<AssignmentUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Optional: create initial tasks together with milestone
  type TaskForm = {
    tempKey: number;
    title: string;
    description: string;
    status: string;
    priority: string;
    start_planned: string;
    end_planned: string;
    budget_cost: string;
    percent_complete: number;
    dependencies?: { depends_on_task_id: number; type?: 'FS'|'SS'|'FF'|'SF'; lag_days?: number }[];
    assigneeIds?: number[];
    assigneeEfforts?: Record<number, string>;
  };
  const [taskForms, setTaskForms] = useState<TaskForm[]>([]);
  const [collapsedTaskKeys, setCollapsedTaskKeys] = useState<Record<number, boolean>>({});
  const nextKeyRef = useRef(1);
  const addEmptyTask = () => setTaskForms((s) => ([...s, {
    tempKey: nextKeyRef.current++,
    title: "",
    description: "",
    status: "To Do",
    priority: "Medium",
    start_planned: "",
    end_planned: "",
    budget_cost: "",
    percent_complete: 0,
    dependencies: [],
    assigneeIds: [],
    assigneeEfforts: {},
  }]));
  const removeTask = (idx: number) => setTaskForms((s) => s.filter((_, i) => i !== idx));
  const toggleTaskCollapsed = (key: number) => {
    setCollapsedTaskKeys((s) => ({ ...s, [key]: !s[key] }));
  };
  const { showToast } = useToast();

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => ({ ...s, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: '' }));
  };

  useEffect(() => {
    if (!projectId) return;

    (async () => {
      try {
        const res = await apiRequest<any>("GET", `/api/projects/${projectId}`);
        const project =
          res && typeof res === "object" && "data" in res ? res.data : res;

        setProjectPlannedStart(toDateOnly(project?.start_planned));
        setProjectPlannedEnd(toDateOnly(project?.end_planned));
      } catch {
        setProjectPlannedStart("");
        setProjectPlannedEnd("");
      }
    })();
  }, [projectId]);

  // Load users for assignment options (robust across API shapes)
  useEffect(() => {
    (async () => {
      setUsersLoading(true);
      try {
        // Try project-scoped members first, then fall back to global users
        const pid = encodeURIComponent(String(projectId));
        const tryPaths = [
          `/api/projects/${pid}/users`,
          `/api/projects/${pid}/members`,
          `/api/projects/${pid}/team`,
          `/api/projects/${pid}/participants`,
          `/api/projects/${pid}/assignable-users`,
          '/api/users/options?status=1',
          '/api/users/options?status=Aktif',
          '/api/users/options',
          '/api/users?status=1',
          '/api/users?status=Aktif',
          '/api/users',
        ];
        let mapped: AssignmentUser[]=[];
        for (const path of tryPaths) {
          try {
            const rs:any = await apiRequest('GET', path);
            let arr:any[]=[];
            if (Array.isArray(rs)) arr=rs; else if (Array.isArray(rs?.data)) arr=rs.data; else if (Array.isArray(rs?.data?.data)) arr=rs.data.data; else if (Array.isArray(rs?.items)) arr=rs.items; else if (Array.isArray(rs?.users)) arr=rs.users;
            // Tolerate various id/name shapes
            mapped = (arr||[]).map((u: RawAssignmentUser) => {
              const division = u.division ?? u.department ?? null;
              return {
                id: Number(u.id ?? u.user_id ?? u.value ?? u.key),
                name: String(u.name ?? u.full_name ?? u.username ?? u.email ?? u.id ?? u.user_id ?? ''),
                role: normalizeUserRole(u),
                roles: Array.isArray(u.roles)
                  ? u.roles
                      .map((role) => (typeof role === "string" ? role : role?.name))
                      .filter((role): role is string => typeof role === "string" && role.trim().length > 0)
                  : [],
                division: division
                  ? {
                      id: Number(division.id ?? division.division_id),
                      name: String(division.name ?? division.division_name ?? division.title ?? "Tanpa Divisi"),
                      code: typeof division.code === "string" ? division.code : null,
                    }
                  : null,
              };
            }).filter((u)=> Number.isFinite(u.id));
            // Deduplicate by id
            const seen = new Set<number>();
            mapped = mapped.filter((u)=> (seen.has(u.id) ? false : (seen.add(u.id), true)));
            if (mapped.length) break;
          } catch {}
        }
        setUsers(mapped);
      } catch { setUsers([]); }
      finally { setUsersLoading(false); }
    })();
  }, []);

  const assignmentUserGroups = useMemo(() => groupAssignmentUsers(users), [users]);

  const resolveAssignmentRole = (userId: number) => {
    const user = users.find((item) => item.id === userId);
    return user?.role || user?.roles[0] || "Member";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      // Validate basic fields
      // Basic client-side validation
      if (!form.name || form.name.length > 150) {
        setFieldErrors((e) => ({ ...e, name: "Name is required and must be <= 150 chars" }));
        showToast({
          variant: "error",
          title: "Form milestone tidak valid",
          description: "Name wajib diisi dan maksimal 150 karakter.",
        });
        setSubmitting(false);
        return;
      }
      if (!MILESTONE_STATUS_OPTIONS.includes(form.status as any)) {
        setFieldErrors((e) => ({ ...e, status: "Invalid status" }));
        showToast({
          variant: "error",
          title: "Status milestone tidak valid",
          description: "Pilih status milestone yang tersedia.",
        });
        setSubmitting(false);
        return;
      }
      const formDuePlanned = toDateOnly(form.due_planned);
      if (projectPlannedEnd && formDuePlanned && formDuePlanned > projectPlannedEnd) {
        setFieldErrors((e) => ({ ...e, due_planned: `Due Planned tidak boleh melewati Project Planned End (${projectPlannedEnd})` }));
        showToast({
          variant: "error",
          title: "Tanggal milestone tidak valid",
          description: `Due Planned milestone tidak boleh melewati Project Planned End (${projectPlannedEnd}).`,
        });
        setSubmitting(false);
        return;
      }
      // Validate each task row: title required, start <= end, percent 0..100
      for (let i = 0; i < taskForms.length; i++) {
        const t = taskForms[i];
        if (!t.title || t.title.trim().length === 0) {
          showToast({
            variant: "error",
            title: "Task tidak valid",
            description: `Task #${i + 1} wajib memiliki judul.`,
          });
          setSubmitting(false);
          return;
        }
            if (!t.assigneeIds || t.assigneeIds.length === 0) {
        showToast({
          variant: "error",
          title: "Assignment belum dipilih",
          description: `Task #${i + 1} wajib memiliki minimal 1 assignee.`,
        });
        setSubmitting(false);
        return;
      }
        if (t.start_planned && t.end_planned) {
          const s = Date.parse(t.start_planned);
          const en = Date.parse(t.end_planned);
          if (Number.isFinite(s) && Number.isFinite(en) && s > en) {
            showToast({
              variant: "error",
              title: "Tanggal task tidak valid",
              description: `Task #${i + 1} memiliki Start setelah End. Periksa kembali tanggalnya.`,
            });
            setSubmitting(false);
            return;
          }
        }
        if (projectPlannedEnd) {
          if (t.start_planned && t.start_planned > projectPlannedEnd) {
            showToast({
              variant: "error",
              title: "Tanggal task tidak valid",
              description: `Task #${i + 1} memiliki Start Planned setelah Project Planned End (${projectPlannedEnd}).`,
            });
            setSubmitting(false);
            return;
          }
          if (t.end_planned && t.end_planned > projectPlannedEnd) {
            showToast({
              variant: "error",
              title: "Tanggal task tidak valid",
              description: `Task #${i + 1} memiliki End Planned setelah Project Planned End (${projectPlannedEnd}).`,
            });
            setSubmitting(false);
            return;
          }
        }
        // If milestone due_planned is set, task planned dates must not exceed it.
        // Use lexicographical compare because inputs are YYYY-MM-DD.
        if (formDuePlanned) {
          const due = formDuePlanned;
          if (t.start_planned && t.start_planned > due) {
            showToast({
              variant: "error",
              title: "Tanggal task tidak valid",
              description: `Task #${i + 1} memiliki Start Planned setelah Due Planned milestone (${due}).`,
            });
            setSubmitting(false);
            return;
          }
          if (t.end_planned && t.end_planned > due) {
            showToast({
              variant: "error",
              title: "Tanggal task tidak valid",
              description: `Task #${i + 1} memiliki End Planned setelah Due Planned milestone (${due}).`,
            });
            setSubmitting(false);
            return;
          }
        }
        const pct = Number(t.percent_complete ?? 0);
        if (!(pct >= 0 && pct <= 100)) {
          showToast({
            variant: "error",
            title: "Persentase task tidak valid",
            description: `Task #${i + 1} harus memiliki persen 0–100.`,
          });
          setSubmitting(false);
          return;
        }
      }

      // Soft warning A: sequence vs existing milestones in this project
      let duePlanned = formDuePlanned;
      let dueTs = duePlanned ? Date.parse(duePlanned) : NaN;
      if (projectId && duePlanned && Number.isFinite(dueTs)) {
        try {
          const existing = await listMilestonesByProject(projectId);
          const existDue = (existing || []).map((m: any) => toDateOnly(m?.due_planned)).filter(Boolean) as string[];
          if (existDue.length) {
            const latest = existDue.sort((a,b) => Date.parse(b) - Date.parse(a))[0];
            if (Date.parse(duePlanned) < Date.parse(latest)) {
              if (!projectPlannedEnd || latest <= projectPlannedEnd) {
                const adjustMsg = `Due Planned (${duePlanned}) lebih awal dari milestone lain (terakhir ${latest}).\n\nRekomendasi: sesuaikan Due Planned menjadi ${latest}.\n\nKlik OK untuk menyesuaikan, Cancel untuk pilihan lain.`;
                const okAdj = confirm(adjustMsg);
                if (okAdj) {
                  duePlanned = latest;
                  dueTs = Date.parse(duePlanned);
                } else {
                  const proceed = confirm(`Lanjutkan tanpa menyesuaikan Due Planned (tetap ${duePlanned})?\n\nKlik OK untuk lanjut simpan, Cancel untuk batalkan dan ubah data.`);
                  if (!proceed) { setSubmitting(false); return; }
                }
              }
            }
          }
        } catch {}
      }

      // Soft warning B: tasks exceeding milestone due_planned
      if (duePlanned && Number.isFinite(dueTs)) {
        // find max end_planned among provided tasks
        const endDates = taskForms
          .map(t => toDateOnly(t.end_planned))
          .filter(Boolean) as string[];
        const maxEnd = endDates.length ? endDates.sort((a,b) => Date.parse(b)-Date.parse(a))[0] : '';
        if (maxEnd && Date.parse(maxEnd) > dueTs) {
          if (projectPlannedEnd && maxEnd > projectPlannedEnd) {
            showToast({
              variant: "error",
              title: "Tanggal task tidak valid",
              description: `Tanggal akhir task (${maxEnd}) melewati Project Planned End (${projectPlannedEnd}).`,
            });
            setSubmitting(false);
            return;
          }
          // First prompt: adjust due to max end
          const okAdjust = confirm(`Ada ${endDates.length} task dengan tanggal akhir melebihi Due Planned (${duePlanned}).\n\nRekomendasi: sesuaikan Due Planned menjadi ${maxEnd}.\n\nKlik OK untuk menyesuaikan Due Planned. Klik Cancel untuk pilihan lain.`);
          if (okAdjust) {
            duePlanned = maxEnd;
          } else {
            // Second prompt: continue anyway or cancel submit
            const proceed = confirm(`Lanjutkan tanpa menyesuaikan Due Planned (tetap ${duePlanned})?\n\nKlik OK untuk lanjut simpan, Cancel untuk batalkan dan ubah data.`);
            if (!proceed) {
              setSubmitting(false);
              return;
            }
          }
        }
      }

      const payload: CreateMilestoneDto = {
        name: form.name,
        status: form.status as any,
        due_planned: duePlanned || null,
        // due_actual tidak dikirim saat create; akan diisi otomatis ketika milestone di-mark Complete
      } as any;
      const created = await createForProject(projectId, payload);
      const createdUnwrapped = created && typeof created === 'object' && 'data' in (created as any) ? (created as any).data : created;
      const milestoneId = (createdUnwrapped as any)?.id;
      // Create tasks if provided and milestone was created successfully
      if (milestoneId && Array.isArray(taskForms) && taskForms.length > 0) {
        // Filter rows that at least have a title
        const rows = taskForms.filter(t => (t.title || '').trim().length > 0);
        const createdMap = new Map<number, number>(); // tempKey -> createdId
        const failures: Array<{ title: string; error: unknown }> = [];
        for (const t of rows) {
          try {
            const pctVal = Math.max(0, Math.min(100, Number(t.percent_complete ?? 0) || 0));
            const effectiveStatus = t.status || "To Do";
            const dto: any = {
              title: t.title,
              description: t.description || null,
              status: effectiveStatus,
              priority: t.priority || 'Medium',
              start_planned: t.start_planned || null,
              end_planned: t.end_planned || null,
              percent_complete: pctVal,
              project_id: Number(projectId) || undefined,
              milestone_id: Number(milestoneId) || undefined,
            };
            const costStr = (t.budget_cost || '').trim();
            if (costStr !== '') {
              const costNum = Number(costStr);
              if (Number.isFinite(costNum) && costNum >= 0) {
                dto.budget_cost = costNum;
              }
            }
            if (Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0) {
              dto.assignments = t.assigneeIds.map((id) => {
                const rawEffort = t.assigneeEfforts?.[id] ?? '';
                const effort = rawEffort === '' ? null : Number(rawEffort);

                return {
                  user_id: id,
                  role_on_task: resolveAssignmentRole(id),
                  estimated_effort_hours: Number.isFinite(effort) ? effort : null,
                };
              });
            }
            const dependencies = (t.dependencies || [])
              .map((dep) => {
                const createdId = createdMap.get(Number(dep.depends_on_task_id));
                if (!createdId) return null;
                return {
                  depends_on_task_id: createdId,
                  type: dep.type || 'FS',
                  lag_days: Number(dep.lag_days ?? 0) || 0,
                };
              })
              .filter(Boolean);
            if (dependencies.length) {
              dto.dependencies = dependencies;
            }
            let createdTask: any = null;
            try {
              createdTask = await createTaskForMilestone(milestoneId, dto);
            } catch (err: any) {
              // Fallbacks for diverse backends
              try {
                // Try flat /api/tasks with milestone_id and project_id
                const body1 = { ...dto, milestone_id: Number(milestoneId), project_id: Number(projectId) };
                createdTask = await apiRequest<any>('POST', '/api/tasks', body1);
              } catch (e2: any) {
                // Try nested project route
                const body2 = { ...dto, milestone_id: Number(milestoneId) };
                createdTask = await apiRequest<any>('POST', `/api/projects/${projectId}/tasks`, body2);
              }
            }
            const unwrapped = createdTask && typeof createdTask === 'object' && 'data' in createdTask ? (createdTask as any).data : createdTask;
            const newId = (unwrapped as any)?.id ?? (unwrapped as any)?.task_id ?? (unwrapped as any)?.task?.id;
            if (newId) createdMap.set(t.tempKey, Number(newId));
            else {
              failures.push({ title: t.title, error: createdTask });
            }
          } catch (e) {
            // Keep creating the rest; surface a generic notice
            console.warn('Failed to create a task for milestone', e);
            failures.push({ title: t.title, error: e });
          }
        }
        if (failures.length > 0) {
          console.error("Some tasks failed to create:", failures);
          showToast({
            variant: "warning",
            title: "Beberapa task gagal dibuat",
            description: `${failures.length} task gagal dibuat. Cek konsol untuk detail teknis.`,
          });
        }
      }
      showToast({
        variant: "success",
        title: "Milestone dibuat",
        description: "Milestone baru berhasil dibuat untuk project ini.",
      });
      // Redirect back to Project Detail so the new milestone appears in the detail page section
      router.push(`/dashboard/projects/${projectId}`);
    } catch (e: any) {
      // 422 validation mapping (Laravel)
      const errors = e?.response?.data?.errors;
      if (errors && typeof errors === 'object') {
        const mapped: FieldErrors = {};
        Object.keys(errors).forEach((k) => {
          const val = errors[k];
          mapped[k] = Array.isArray(val) ? val.join(', ') : String(val ?? 'Invalid');
        });
        setFieldErrors(mapped);
      } else if (e?.response?.status === 404) {
        // Some backends use 404 for unauthorized project access (policy hides existence)
        const msg = "Project tidak ditemukan atau kamu tidak punya akses.";
        setError(msg);
        showToast({
          variant: "error",
          title: "Gagal membuat milestone",
          description: msg,
        });
      } else if (e?.response?.status === 401 || e?.response?.status === 403) {
        const msg = "Kamu tidak diizinkan untuk membuat milestone.";
        setError(msg);
        showToast({
          variant: "error",
          title: "Tidak berizin",
          description: msg,
        });
      } else {
        const msg = e?.message ?? "Failed to create milestone";
        setError(msg);
        showToast({
          variant: "error",
          title: "Gagal membuat milestone",
          description: msg,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 w-full min-w-0 overflow-x-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 w-full min-w-0">
        <div className="space-y-2">
          <a
            href={`/dashboard/projects/${projectId}`}
            className="group inline-flex items-center gap-2 text-sm font-medium text-[#00674F] transition hover:text-[#008061]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#00674F]/10 text-[#00674F] transition group-hover:bg-[#008061]/20 group-hover:text-[#008061]">
              <ChevronLeft className="h-4 w-4" />
            </span>
            Back to Project
          </a>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900">Create Milestone</h1>
          <p className="max-w-xl text-sm text-slate-500">Tambahkan milestone baru untuk project ini. Pastikan tanggal dan status sesuai.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600 shadow-sm">
          {error}
        </div>
      )}

      <div className="grid items-stretch gap-8 min-w-0 w-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: tips/checklist */}
        <aside className="min-w-0 self-stretch flex h-full flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 p-7 text-white shadow-[0_4px_25px_-8px_rgba(0,128,96,0.25)]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold uppercase tracking-[0.32em] text-emerald-50">Milestone Tips</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-white/70" />Nama singkat dan jelas.</li>
              <li className="flex items-start gap-2"><span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-white/70" />Gunakan Due Planned sebagai target.</li>
              <li className="flex items-start gap-2"><span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-white/70" />Tasks opsional; bisa ditambahkan di detail project.</li>
            </ul>
          </div>
          <div className="text-xs/5 text-white/90">
            Project ID: <span className="font-semibold">{String(projectId)}</span>
          </div>
        </aside>

        {/* Right: form */}
        <form onSubmit={onSubmit} className="min-w-0 rounded-[24px] border border-transparent bg-white/95 shadow-[0_22px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-100 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input name="name" value={form.name} onChange={onChange} required maxLength={150} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" placeholder="e.g. Phase 1 Delivery" />
              {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
            </div>
            {/* Status hidden: default "Planned" used server-side */}
            <div>
              <label className="block text-sm mb-1">Due Planned</label>
              <input type="date" name="due_planned" value={form.due_planned} onChange={onChange} min={projectPlannedStart || undefined} max={projectPlannedEnd || undefined} className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300" />
              {fieldErrors.due_planned && <p className="text-xs text-red-600 mt-1">{fieldErrors.due_planned}</p>}
            </div>
            <div>
              <label className="block text-sm mb-1">Due Actual</label>
              <input
                type="date"
                name="due_actual"
                value={form.due_actual}
                onChange={onChange}
                className="h-11 w-full rounded-xl border border-slate-200 bg-neutral-50 px-4 text-sm font-medium text-neutral-500 shadow-inner"
                disabled
                readOnly
                placeholder="Auto-filled when milestone is completed"
              />
              <p className="text-xs text-neutral-500 mt-1">Nilai ini akan terisi otomatis saat milestone ditandai Completed.</p>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">Tasks (optional)</h3>
              <button type="button" onClick={addEmptyTask} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-neutral-50">Add Task</button>
            </div>
            {taskForms.length === 0 ? (
              <p className="text-xs text-neutral-500">Kamu bisa menambahkan task pertama milestone di sini. Ini opsional.</p>
            ) : (
              <div className="grid gap-3">
                {taskForms.map((t, idx) => {
                  const hasContent =
                    (t.title || "").trim().length > 0 ||
                    (t.start_planned || "").trim().length > 0 ||
                    (t.end_planned || "").trim().length > 0 ||
                    (t.budget_cost || "").trim().length > 0 ||
                    (Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0) ||
                    Object.values(t.assigneeEfforts ?? {}).some((value) => String(value ?? "").trim().length > 0) ||
                    (Array.isArray(t.dependencies) && t.dependencies.length > 0);
                  const totalEstimatedEffort = (t.assigneeIds ?? []).reduce((sum, userId) => {
                    const value = Number(t.assigneeEfforts?.[userId] ?? 0);
                    return sum + (Number.isFinite(value) ? value : 0);
                  }, 0);
                  const collapsed = !!collapsedTaskKeys[t.tempKey];
                  return (
                  <div key={t.tempKey} className="relative overflow-hidden rounded-2xl border border-slate-200 p-4 grid gap-3 bg-white/95 ring-1 ring-slate-100 shadow-[0_12px_24px_rgba(15,23,42,0.06),0_10px_24px_rgba(0,103,79,0.12)] transition hover:shadow-[0_16px_32px_rgba(15,23,42,0.08),0_14px_32px_rgba(0,103,79,0.18)]">
                    <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl" style={{ backgroundColor: TASK_CARD_COLORS[idx % TASK_CARD_COLORS.length] }} />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-neutral-600 min-w-0">
                        <span>Task #{idx + 1}</span>
                        {hasContent && (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {(t.status || 'To Do')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasContent && (
                          <button
                            type="button"
                            onClick={() => toggleTaskCollapsed(t.tempKey)}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-[#00674F] hover:bg-[#00674F]/5 hover:text-[#00674F]"
                          >
                            {collapsed ? "Show task" : "Hide task"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeTask(idx)}
                          className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-100"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {hasContent && collapsed ? (
                      <div className="rounded-2xl border border-emerald-50 bg-emerald-50/60 px-3 py-2 text-xs text-slate-700 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 truncate max-w-[220px]">{t.title}</span>
                        <span className="inline-flex items-center rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          {(t.start_planned || 'Start ?')} — {(t.end_planned || 'End ?')}
                        </span>
                        {Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0 && (
                          <span className="text-[11px] text-slate-600">
                            {t.assigneeIds.length} assignee{t.assigneeIds.length > 1 ? 's' : ''}
                          </span>
                        )}
                        {totalEstimatedEffort > 0 && (
                          <span className="text-[11px] text-slate-600">
                            Effort {totalEstimatedEffort} h
                          </span>
                        )}
                      </div>
                    ) : (
                    <>
                    <div>
                      <label className="block text-sm mb-1">Title</label>
                      <input
                        value={t.title}
                        onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, title: e.target.value } : x))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner"
                        placeholder="e.g. Implement Middleware RBAC"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Description</label>
                      <textarea
                        value={t.description}
                        onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))}
                        rows={4}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                        placeholder="Context, goals, acceptance criteria..."
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm mb-1">Priority</label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300">
                              <span className={t.priority ? 'text-slate-700' : 'text-slate-400'}>{t.priority || 'Pilih priority'}</span>
                              <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[200px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
                            {TASK_PRIORITY_OPTIONS.map((popt) => (
                              <DropdownMenuItem key={popt} onSelect={() => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, priority: popt } : x))} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700">
                                <span>{popt}</span>
                                {t.priority === popt && <Check className="h-4 w-4 text-emerald-500" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div>
                        <label className="block text-sm mb-1">Status</label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="group flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 shadow-inner transition-all duration-300 ease-out hover:border-emerald-400 focus:border-emerald-500 focus:shadow-[0_18px_36px_rgba(16,185,129,0.16)] focus:outline-none focus:ring-2 focus:ring-emerald-300">
                              <span className={t.status ? 'text-slate-700' : 'text-slate-400'}>{t.status || 'Pilih status'}</span>
                              <ChevronsUpDown className="h-4 w-4 text-emerald-400 transition group-hover:text-emerald-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[200px] rounded-xl border border-emerald-100 bg-white/95 p-1 shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
                            {TASK_STATUS_OPTIONS.map((sopt) => (
                              <DropdownMenuItem key={sopt} onSelect={() => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, status: sopt } : x))} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-600 focus:bg-emerald-100/60 focus:text-emerald-700">
                                <span>{sopt}</span>
                                {t.status === sopt && <Check className="h-4 w-4 text-emerald-500" />}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm mb-1">Start Planned</label>
                        <input type="date" value={t.start_planned}
                          onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, start_planned: e.target.value } : x))}
                          min={projectPlannedStart || undefined}
                          max={milestoneDueMax}
                          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner" />
                      </div>
                      <div>
                        <label className="block text-sm mb-1">End Planned</label>
                        <input type="date" value={t.end_planned}
                          onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, end_planned: e.target.value } : x))}
                          min={t.start_planned || projectPlannedStart || undefined}
                          max={milestoneDueMax}
                          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner" />
                      </div>
                    </div>
                    <div>
                      <IdrCurrencyInput
                        id={`task_${t.tempKey}_budget_cost`}
                        label="Budget Cost (IDR) (optional)"
                        raw={t.budget_cost}
                        onRawChange={(raw) =>
                          setTaskForms((s) =>
                            s.map((x, i) =>
                              i === idx ? { ...x, budget_cost: raw } : x
                            )
                          )
                        }
                        placeholder="0"
                        hint="Opsional. Isi jika task ini punya budget biaya untuk perhitungan EVM (Cost-Based / IDR)."
                        inputClassName="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Percent Complete</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={t.percent_complete}
                        onChange={(e) => setTaskForms((s) => s.map((x, i) => i === idx ? { ...x, percent_complete: Number(e.target.value) } : x))}
                        className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                        placeholder="0-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1"> Assignments <span className="text-rose-500">*</span></label>
                      {usersLoading ? (
                        <Skeleton className="h-20 w-full rounded-xl bg-neutral-200/50" />
                      ) : users.length === 0 ? (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">No users available.</div>
                      ) : (
                        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-inner max-h-56 overflow-auto text-sm">
                          <div className="grid grid-cols-1 gap-3">
                            {assignmentUserGroups.map((group) => (
                              <div key={group.key} className="space-y-1">
                                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-2 py-2 backdrop-blur">
                                  <span className="text-xs font-semibold uppercase text-slate-500">{group.name}</span>
                                  <span className="text-[11px] font-medium text-slate-400">{group.users.length} user</span>
                                </div>
                                {group.users.map((u) => {
                                  const checked = (t.assigneeIds || []).includes(u.id);
                                  return (
                                    <div key={u.id}>
                                      <label className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                                        <span className="flex min-w-0 items-center gap-2">
                                          <span className="truncate text-slate-700">{u.name}</span>
                                          {u.role ? (
                                            <span className="shrink-0 rounded border border-slate-200 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
                                              {u.role}
                                            </span>
                                          ) : null}
                                        </span>
                                        <input
                                          type="checkbox"
                                          className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-500 focus:ring-emerald-300"
                                          checked={checked}
                                          onChange={(e) => {
                                            setTaskForms((s) => s.map((x, i) => {
                                              if (i !== idx) return x;
                                              const set = new Set(x.assigneeIds || []);
                                              const efforts = { ...(x.assigneeEfforts ?? {}) };
                                              if (e.target.checked) {
                                                set.add(u.id);
                                                if (!(u.id in efforts)) efforts[u.id] = '';
                                              } else {
                                                set.delete(u.id);
                                                delete efforts[u.id];
                                              }
                                              return { ...x, assigneeIds: Array.from(set), assigneeEfforts: efforts };
                                            }));
                                          }}
                                        />
                                      </label>
                                      {checked && (
                                        <div className="mb-2 ml-2 mr-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                                          <label className="mb-1 block text-xs font-medium text-slate-500">
                                            Estimated Effort (hours)
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            max={10000}
                                            step={1}
                                            value={t.assigneeEfforts?.[u.id] ?? ''}
                                            onChange={(e) => {
                                              const raw = e.target.value;
                                              setTaskForms((s) =>
                                                s.map((x, i) => {
                                                  if (i !== idx) return x;
                                                  return {
                                                    ...x,
                                                    assigneeEfforts: {
                                                      ...(x.assigneeEfforts ?? {}),
                                                      [u.id]: raw === '' ? '' : String(Math.max(0, Number(raw) || 0)),
                                                    },
                                                  };
                                                })
                                              );
                                            }}
                                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-inner focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300"
                                            placeholder="Kosong = durasi x 8 jam"
                                          />
                                          <p className="mt-1 text-[11px] text-slate-500">
                                            Diakumulasi dengan assignee lain sebagai planned effort task.
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    {idx > 0 && (
                      <div>
                        <label className="block text-sm mb-1">Depends On (previous tasks)</label>
                        <TaskDependencyEditor
                          value={t.dependencies || []}
                          options={taskForms.slice(0, idx).map((cand, cidx) => ({
                            id: cand.tempKey,
                            title: (cand.title && cand.title.trim()) ? cand.title : `Task #${cidx + 1}`,
                            status: cand.status,
                          }))}
                          onChange={(dependencies) => {
                            setTaskForms((s) => s.map((x, i) => (
                              i === idx ? { ...x, dependencies } : x
                            )));
                          }}
                        />
                      </div>
                    )}
                    </>
                    )}
                  </div>
                );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-[#00674F] px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-[#008061] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Saving' : 'Create Milestone'}
            </button>
            <a href={`/dashboard/projects/${projectId}`} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">Cancel</a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreateProjectMilestonePage() {
  const { loading, allowed } = usePermissionGuard(["membuat milestones"]);

  if (!loading && !allowed) {
    return <Forbidden />;
  }

  if (loading) {
    return null;
  }

  return <CreateProjectMilestonePageContent />;
}
