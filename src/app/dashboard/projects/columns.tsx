"use client";

export type ProjectRow = {
  id: number;
  name: string;
  client_name: string;
  value_amount: number | string;
  status: string;
  division_owner?: { id: number; name: string } | null;
  start_planned?: string | null;
  end_planned?: string | null;
  created_at?: string;
};

export type Column<T> = {
  key: keyof T | "actions";
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
};

export function useProjectColumns(
  onDelete?: (row: ProjectRow) => void,
  opts?: { minimal?: boolean }
): Column<ProjectRow>[] {
  const minimal = opts?.minimal === true;

  const currency = (v: number | string | undefined) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (typeof n === 'number' && Number.isFinite(n)) {
      try {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
      } catch {
        return `IDR ${Math.round(n).toLocaleString()}`;
      }
    }
    return String(v ?? '');
  };

  const fullCols: Column<ProjectRow>[] = [
    { key: "name", header: "Project" },
    { key: "client_name", header: "Client" },
    { key: "value_amount", header: "Value", render: (r) => currency(r.value_amount) },
    { key: "status", header: "Status" },
    { key: "division_owner", header: "Owner", render: (r) => r.division_owner?.name ?? '-' },
    { key: "start_planned", header: "Start" },
    { key: "end_planned", header: "End" },
  ];

  const minimalCols: Column<ProjectRow>[] = [
    { key: "name", header: "Project" },
    { key: "status", header: "Status" },
    { key: "start_planned", header: "Start" },
    { key: "end_planned", header: "End" },
  ];

  const cols = minimal ? minimalCols : fullCols;

  return [
    ...cols,
    {
      key: "actions",
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2 text-sm">
          <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/projects/${row.id}`}>Detail</a>
          <a className="px-2 py-1 rounded-md border hover:bg-neutral-50" href={`/dashboard/projects/${row.id}/edit`}>Edit</a>
          <button className="px-2 py-1 rounded-md border text-red-600 hover:bg-red-50" onClick={() => onDelete?.(row)}>Delete</button>
        </div>
      ),
    },
  ];
}
