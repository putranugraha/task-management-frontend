"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createForProject, MILESTONE_STATUS_OPTIONS, type CreateMilestoneDto } from "@/lib/api/milestones";

type FormState = {
  name: string;
  status: string;
  due_planned: string;
  due_actual: string;
};

type FieldErrors = Partial<Record<keyof CreateMilestoneDto, string>> & { [k: string]: string };

export default function CreateProjectMilestonePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params?.id as string;

  const [form, setForm] = useState<FormState>({
    name: "",
    status: "Planned",
    due_planned: "",
    due_actual: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setForm((s) => ({ ...s, [name]: value }));
    setFieldErrors((errs) => ({ ...errs, [name]: '' }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      // Basic client-side validation
      if (!form.name || form.name.length > 150) {
        setFieldErrors((e) => ({ ...e, name: 'Name is required and must be <= 150 chars' }));
        setSubmitting(false);
        return;
      }
      if (!MILESTONE_STATUS_OPTIONS.includes(form.status as any)) {
        setFieldErrors((e) => ({ ...e, status: 'Invalid status' }));
        setSubmitting(false);
        return;
      }

      const payload: CreateMilestoneDto = {
        name: form.name,
        status: form.status as any,
        due_planned: form.due_planned || null,
        due_actual: form.due_actual || null,
      };
      await createForProject(projectId, payload);
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
        setError('Project not found or you may not have permission');
      } else if (e?.response?.status === 401 || e?.response?.status === 403) {
        setError('Not authorized to perform this action');
      } else {
        setError(e?.message ?? 'Failed to create milestone');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-semibold mb-3">Create Milestone for Project #{projectId}</h2>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input name="name" value={form.name} onChange={onChange} required maxLength={150} className="w-full border rounded-md px-3 py-2" />
          {fieldErrors.name && <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Status</label>
            <select name="status" value={form.status} onChange={onChange} className="w-full border rounded-md px-3 py-2">
              {MILESTONE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {fieldErrors.status && <p className="text-xs text-red-600 mt-1">{fieldErrors.status}</p>}
          </div>
          <div>
            <label className="block text-sm mb-1">Due Planned</label>
            <input type="date" name="due_planned" value={form.due_planned} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
            {fieldErrors.due_planned && <p className="text-xs text-red-600 mt-1">{fieldErrors.due_planned}</p>}
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Due Actual</label>
          <input type="date" name="due_actual" value={form.due_actual} onChange={onChange} className="w-full border rounded-md px-3 py-2" />
          {fieldErrors.due_actual && <p className="text-xs text-red-600 mt-1">{fieldErrors.due_actual}</p>}
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="submit" disabled={submitting} className="px-3 py-2 rounded-md border text-sm hover:bg-neutral-50">{submitting ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={() => history.back()} className="px-3 py-2 rounded-md border text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
