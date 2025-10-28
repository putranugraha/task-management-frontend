export type TaskBaseline = {
  id: number;
  baseline_id: number | null;
  task_id: number;
  start_planned_base: string | null;
  end_planned_base: string | null;
  duration_planned_base: number | null;
  weight: number | null;
  planned_effort_hours: number | null;
  task?: { id: number; title: string; project_id: number };
};

export type EvmResponse = {
  project_id: number;
  date: string;
  baseline_id: number | null;
  pv: number;
  ev: number;
  ac: number;
  sv: number;
  spi: number | null;
  cv: number;
  cpi: number | null;
  meta: {
    hours_per_day: number;
    task_count: number;
    assignments_as_primary_effort: boolean;
    pv_fraction_inclusive_days: boolean;
    baseline_used: boolean;
  };
};

