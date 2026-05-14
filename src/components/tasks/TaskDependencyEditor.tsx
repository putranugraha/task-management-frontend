"use client";

import { Plus, Trash2 } from "lucide-react";

export type DependencyType = "FS" | "SS" | "FF" | "SF";

export type DependencyValue = {
  depends_on_task_id: number;
  type?: DependencyType;
  lag_days?: number;
};

export type DependencyOption = {
  id: number;
  title: string;
  status?: string;
};

const TYPE_OPTIONS: Array<{ value: DependencyType; label: string }> = [
  { value: "FS", label: "Finish to Start" },
  { value: "SS", label: "Start to Start" },
  { value: "FF", label: "Finish to Finish" },
  { value: "SF", label: "Start to Finish" },
];

type Props = {
  value?: DependencyValue[];
  options: DependencyOption[];
  loading?: boolean;
  emptyMessage?: string;
  onChange: (next: DependencyValue[]) => void;
};

export default function TaskDependencyEditor({
  value = [],
  options,
  loading = false,
  emptyMessage = "No dependency candidates.",
  onChange,
}: Props) {
  const selectedIds = new Set(value.map((item) => Number(item.depends_on_task_id)));
  const remaining = options.filter((option) => !selectedIds.has(Number(option.id)));

  const addDependency = () => {
    const first = remaining[0];
    if (!first) return;
    onChange([
      ...value,
      { depends_on_task_id: Number(first.id), type: "FS", lag_days: 0 },
    ]);
  };

  const updateDependency = (index: number, patch: Partial<DependencyValue>) => {
    onChange(value.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  };

  const removeDependency = (index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  };

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">Loading dependencies...</div>;
  }

  if (options.length === 0) {
    return <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-inner">
      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
          Belum ada dependency.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((dependency, index) => {
            const currentId = Number(dependency.depends_on_task_id);
            const selectable = options.filter((option) => (
              Number(option.id) === currentId || !selectedIds.has(Number(option.id))
            ));

            return (
              <div key={`${currentId}-${index}`} className="grid gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2 md:grid-cols-[minmax(0,1fr)_170px_110px_40px]">
                <select
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  value={currentId || ""}
                  onChange={(event) => updateDependency(index, { depends_on_task_id: Number(event.target.value) })}
                >
                  {selectable.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </select>
                <select
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  value={dependency.type ?? "FS"}
                  onChange={(event) => updateDependency(index, { type: event.target.value as DependencyType })}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={-365}
                  max={365}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                  value={Number(dependency.lag_days ?? 0)}
                  onChange={(event) => updateDependency(index, { lag_days: Number(event.target.value || 0) })}
                />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-red-100 bg-white text-red-500 transition hover:bg-red-50"
                  onClick={() => removeDependency(index)}
                  aria-label="Remove dependency"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={addDependency}
        disabled={remaining.length === 0}
      >
        <Plus className="h-4 w-4" />
        Add Dependency
      </button>
    </div>
  );
}
