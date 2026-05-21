"use client";

import * as React from "react";
import type { ProjectBaseline } from "@/types/project-baseline";
import { useBaselines } from "@/hooks/useBaselines";

export type BaselineSelectProps = {
  projectId: number | string;
  value: number | null | undefined;
  onChange: (baselineId: number | null) => void;
  includeNoneOption?: boolean;
  className?: string;
};

/**
 * BaselineSelect
 * - Minimal dropdown for project baselines.
 * - Uses useBaselines(projectId) internally.
 */
export function BaselineSelect({ projectId, value, onChange, includeNoneOption = true, className }: BaselineSelectProps) {
  const { baselines, isLoading, error } = useBaselines(projectId);
  const projectBaselines = React.useMemo(
    () => (Array.isArray(baselines)
      ? baselines.filter((baseline: any) => String(baseline?.project_id ?? "") === String(projectId))
      : []),
    [baselines, projectId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === "__none__") return onChange(null);
    const id = Number(v);
    onChange(Number.isFinite(id) ? id : null);
  };

  const selected = value != null && projectBaselines.some((baseline) => Number(baseline.id) === Number(value))
    ? String(value)
    : "__none__";

  return (
    <div className={className}>
      <label className="block text-xs text-neutral-600 mb-1">Baseline</label>
      <select
        className="w-full border rounded-md px-3 py-2 text-sm bg-white"
        value={selected}
        onChange={handleChange}
        disabled={isLoading}
        aria-label="Select Project Baseline"
      >
        {includeNoneOption && (
          <option value="__none__">Current Plan (no baseline)</option>
        )}
        {isLoading && <option value="" disabled>Loading baselines…</option>}
        {(!isLoading && error) && <option value="" disabled>Error loading baselines</option>}
        {(!isLoading && !error && projectBaselines.length === 0) && <option value="" disabled>No baselines</option>}
        {projectBaselines.map((b: ProjectBaseline) => (
          <option key={b.id} value={String(b.id)}>
            {b.baseline_name} {b.taken_at ? `• ${b.taken_at}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export default BaselineSelect;
