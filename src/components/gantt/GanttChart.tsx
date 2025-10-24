"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";
import type { ProjectBaseline } from "@/types/project-baseline";

type Zoom = "day" | "week";

export default function GanttChart({
  tasks,
  milestones,
  baselines,
}: {
  tasks: Task[];
  milestones: Milestone[];
  baselines?: ProjectBaseline[];
}) {
  const [zoom, setZoom] = useState<Zoom>("day");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const [showDeps, setShowDeps] = useState<boolean>(true);

  const model = useMemo(() => buildModel(tasks, milestones), [tasks, milestones]);

  const gridDays = Math.max(1, daysDiffInclusive(model.startDate, model.endDate));
  // Responsive scaling: ensure the chart fills available viewport width.
  const basePxPerDay = zoom === "day" ? 32 : 16;
  const pxPerDay = useMemo(() => {
    if (!gridDays) return basePxPerDay;
    const fit = viewportWidth ? Math.floor((viewportWidth - 1) / gridDays) : basePxPerDay;
    return Math.max(basePxPerDay, fit);
  }, [viewportWidth, gridDays, basePxPerDay]);
  const totalWidth = Math.max(gridDays * pxPerDay, viewportWidth || 0);

  // Pick the latest baseline with valid start/end (by taken_at desc, then id desc) if available
  const baselineWindow = useMemo(() => {
    const arr = Array.isArray(baselines) ? baselines.slice() : [];
    arr.sort((a: any, b: any) => {
      const ta = a?.taken_at ? Date.parse(a.taken_at) : 0;
      const tb = b?.taken_at ? Date.parse(b.taken_at) : 0;
      if (tb !== ta) return tb - ta;
      return (Number(b?.id ?? 0) - Number(a?.id ?? 0));
    });
    for (const b of arr) {
      const s = b?.start_planned_base || null;
      const e = b?.end_planned_base || null;
      if (s && e) {
        const sd = toDateOnly(s);
        const ed = toDateOnly(e);
        if (sd <= ed) {
          return { start: sd, end: ed, meta: b } as { start: Date; end: Date; meta: ProjectBaseline };
        }
      }
    }
    return null as null | { start: Date; end: Date; meta: ProjectBaseline };
  }, [baselines]);

  const todayX = (() => {
    const t = toDateOnly(new Date());
    if (!model.startDate || !model.endDate) return null;
    if (t < model.startDate || t > model.endDate) return null;
    // position line at center of the corresponding day cell
    return daysBetween(model.startDate, t) * pxPerDay + Math.floor(pxPerDay / 2);
  })();

  // Observe viewport width of the scroll container to adapt pxPerDay
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth || 0);
    update();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    }
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      if (ro) ro.disconnect();
    };
  }, []);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-neutral-50">
        <div className="text-sm text-neutral-700">
          Range: {fmt(model.startDate)} – {fmt(model.endDate)} • Tasks with dates: {model.rows.reduce((n, r) => n + r.items.length, 0)}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="inline-flex items-center gap-1 text-neutral-700">
            <input type="checkbox" className="h-4 w-4" checked={showDeps} onChange={(e) => setShowDeps(e.target.checked)} />
            <span>Dependencies</span>
          </label>
          <button
            type="button"
            onClick={() => exportCsv(model)}
            className="px-2 py-1 border rounded hover:bg-neutral-100"
            title="Export schedule as CSV"
          >Export CSV</button>
          <label className="text-neutral-600">Zoom</label>
          <select value={zoom} onChange={(e) => setZoom(e.target.value as Zoom)} className="border rounded px-2 py-1">
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-80 shrink-0 border-r bg-white">
          <div className="h-8 px-3 flex items-center text-xs text-neutral-600 border-b">Milestone / Task</div>
          <div>
            {model.rows.map((row, idx) => (
              <div key={row.id} className="border-b">
                <div className="px-3 py-2 text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: colorForIndex(idx) }} />
                  <span className="truncate" title={row.name}>{row.name}</span>
                </div>
                {row.items.map((it) => (
                  <div key={it.id} className="px-3 py-1 text-xs text-neutral-700 truncate">{it.title}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div ref={scrollRef} className="relative min-w-0 overflow-x-auto flex-1">
          {/* Header grid */}
          <div className="relative" style={{ width: totalWidth }}>
            <div className="h-8 border-b flex">
              {Array.from({ length: gridDays }).map((_, i) => (
                <div key={i} className="h-full border-r text-[10px] text-neutral-500 grid place-items-center select-none" style={{ width: pxPerDay }}>
                  {i % (zoom === "week" ? 7 : 1) === 0 ? labelForOffset(model.startDate, i) : null}
                </div>
              ))}
            </div>

            {/* Project baseline overlay (if available) */}
            {baselineWindow && model.startDate && model.endDate && (
              (() => {
                const start = baselineWindow.start;
                const end = baselineWindow.end;
                // Clamp to visible range
                const leftDays = Math.max(0, daysBetween(model.startDate!, start));
                const rightDays = Math.min(gridDays, daysBetween(model.startDate!, end) + 1);
                const left = leftDays * pxPerDay;
                const width = Math.max(0, (rightDays - leftDays) * pxPerDay);
                if (width <= 0) return null;
                return (
                  <div className="absolute left-0 right-0" style={{ top: 32, bottom: 0 }}>
                    <div
                      className="absolute h-full bg-indigo-200/25 border-x-2 border-indigo-300/60"
                      style={{ left, width }}
                      title={`Baseline: ${fmt(start)} – ${fmt(end)}`}
                    />
                  </div>
                );
              })()
            )}

            {/* Grid rows + bars */}
            <div>
              {model.rows.map((row, rowIdx) => (
                <div key={row.id} className="relative border-b" style={{ height: Math.max(24, row.items.length * 22 + 12) }}>
                  {/* light grid */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="flex h-full">
                      {Array.from({ length: gridDays }).map((_, i) => (
                        <div key={i} className={"border-r " + (i % 7 === 0 ? "bg-neutral-50" : "bg-white")} style={{ width: pxPerDay }} />
                      ))}
                    </div>
                  </div>

                  {/* milestone marker */}
                  {row.due && inRange(row.due, model.startDate, model.endDate) && (
                    <div className="absolute inset-y-0" style={{ left: (daysBetween(model.startDate!, row.due) * pxPerDay) }}>
                      <div className="h-full w-[2px] bg-rose-400/80" />
                    </div>
                  )}

                  {/* bars */}
                  <div className="relative">
                    {row.items.map((it, idx) => {
                      if (!it.start || !it.end) return null;
                      const x = daysBetween(model.startDate!, it.start) * pxPerDay;
                      const w = Math.max(pxPerDay, daysDiffInclusive(it.start, it.end) * pxPerDay);
                      const y = 8 + idx * 22;
                      const progress = Math.max(0, Math.min(100, it.percent || 0));
                      const color = colorForIndex(rowIdx);
                      const durationDays = daysDiffInclusive(it.start, it.end);
                      const tooltip = `${it.title}\n${fmt(it.start)} – ${fmt(it.end)} (${durationDays} day${durationDays>1?'s':''})\nMilestone: ${row.name}\nProgress: ${progress}%`;
                      return (
                        <a key={it.id} href={`/dashboard/tasks/${it.id}`} className="absolute block rounded transition-colors"
                           style={{ left: x, top: y, width: w, height: 14, backgroundColor: '#d1d5db' }} title={tooltip}>
                          <div className="absolute inset-y-0 left-0 rounded-l" style={{ width: 4, backgroundColor: color }} />
                          <div className="h-full rounded bg-emerald-500/80" style={{ width: `${progress}%` }} />
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Dependencies overlay (FS only for now) */}
            {showDeps && (
              <DependenciesOverlay model={model} gridDays={gridDays} pxPerDay={pxPerDay} />
            )}

            {/* Today line */}
            {todayX !== null && (
              <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: todayX }}>
                <div className="w-[2px] h-full bg-sky-500/80" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----- helpers -----
function toDateOnly(d: Date | string): Date {
  const src = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  return new Date(src.getFullYear(), src.getMonth(), src.getDate());
}

function daysDiffInclusive(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0;
  const A = toDateOnly(a).getTime();
  const B = toDateOnly(b).getTime();
  const diff = Math.round((B - A) / 86400000) + 1; // inclusive
  return Math.max(1, diff);
}

function daysBetween(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0;
  const A = toDateOnly(a).getTime();
  const B = toDateOnly(b).getTime();
  return Math.floor((B - A) / 86400000);
}

function labelForOffset(start: Date | null, offsetDays: number) {
  if (!start) return "";
  const d = new Date(start);
  d.setDate(d.getDate() + offsetDays);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}`;
}

function fmt(d: Date | null) {
  if (!d) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inRange(d: Date, start: Date | null, end: Date | null) {
  if (!start || !end) return false;
  const t = toDateOnly(d).getTime();
  return t >= toDateOnly(start).getTime() && t <= toDateOnly(end).getTime();
}

function buildModel(tasks: Task[], milestones: Milestone[]) {
  const items = (tasks || []).filter(t => t.start_planned && t.end_planned);
  const dates: Date[] = [];
  for (const t of items) {
    dates.push(toDateOnly(t.start_planned!));
    dates.push(toDateOnly(t.end_planned!));
  }
  const startDate = dates.length ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
  const endDate = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

  // group by milestone
  const byMilestone: Record<string, { id: string; name: string; due: Date | null; items: Array<{ id: number; title: string; start: Date | null; end: Date | null; percent: number; deps?: any[] }> }> = {};
  for (const m of (milestones || [])) {
    byMilestone[String(m.id)] = {
      id: String(m.id),
      name: m.name,
      due: m.due_planned ? toDateOnly(m.due_planned) : null,
      items: [],
    };
  }
  // fallback group for tasks without milestone
  byMilestone["__none__"] = { id: "__none__", name: "Unassigned", due: null, items: [] };

  for (const t of items) {
    const key = t.milestone_id ? String(t.milestone_id) : "__none__";
    const bucket = byMilestone[key] || byMilestone["__none__"];
    bucket.items.push({
      id: t.id,
      title: t.title,
      start: t.start_planned ? toDateOnly(t.start_planned) : null,
      end: t.end_planned ? toDateOnly(t.end_planned) : null,
      percent: Number(t.percent_complete ?? 0),
      deps: (t as any)?.dependencies,
    });
  }

  const rows = Object.values(byMilestone)
    .filter(r => r.items.length > 0)
    .sort((a, b) => {
      const da = a.due ? a.due.getTime() : Number.POSITIVE_INFINITY;
      const db = b.due ? b.due.getTime() : Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });

  return { startDate, endDate, rows };
}

// Simple distinct color palette for milestones
function colorForIndex(i: number) {
  const palette = [
    '#f97316', // orange-500
    '#10b981', // emerald-500
    '#3b82f6', // blue-500
    '#a855f7', // purple-500
    '#ef4444', // red-500
    '#14b8a6', // teal-500
  ];
  return palette[i % palette.length];
}

// Build and copy CSV schedule (Milestone, Task, Start, End, Duration, Dependency, Description)
function exportCsv(model: ReturnType<typeof buildModel>) {
  const rows: string[] = [];
  rows.push(['"Milestone"','"Task"','"Start Date"','"End Date"','"Duration"','"Dependency"','"Description"'].join(','));
  const taskTitleById = new Map<number,string>();
  model.rows.forEach(r => r.items.forEach(it => taskTitleById.set(it.id, it.title)));
  for (const r of model.rows) {
    for (const it of r.items) {
      const deps = Array.isArray(it.deps) ? it.deps.map((d: any) => d?.depends_on?.title || taskTitleById.get(Number(d?.depends_on?.id)) || `Task #${d?.depends_on?.id ?? ''}`) : [];
      const duration = daysDiffInclusive(it.start, it.end);
      const line = [
        csv(r.name),
        csv(it.title),
        csv(fmt(it.start)),
        csv(fmt(it.end)),
        csv(`${duration} hari`),
        csv(deps.join(' | ') || '-'),
        csv(''),
      ].join(',');
      rows.push(line);
    }
  }
  const csvText = rows.join('\n');
  try { navigator.clipboard?.writeText(csvText); } catch {}
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'schedule.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csv(v: string) {
  const s = (v ?? '').toString();
  return '"' + s.replace(/"/g, '""') + '"';
}

// Draw FS dependencies between tasks
function DependenciesOverlay({ model, gridDays, pxPerDay }: { model: ReturnType<typeof buildModel>; gridDays: number; pxPerDay: number }) {
  // Compute layout positions for each task id
  let yAcc = 0;
  const rowHeights = model.rows.map(r => Math.max(24, r.items.length * 22 + 12));
  const pos = new Map<number, { x: number; w: number; cy: number }>();
  model.rows.forEach((row, rIdx) => {
    const rowTop = yAcc;
    row.items.forEach((it, idx) => {
      if (!it.start || !it.end) return;
      const x = daysBetween(model.startDate!, it.start) * pxPerDay;
      const w = Math.max(pxPerDay, daysDiffInclusive(it.start, it.end) * pxPerDay);
      const y = rowTop + 8 + idx * 22 + 7; // center of bar
      pos.set(it.id, { x, w, cy: y });
    });
    yAcc += rowHeights[rIdx];
  });

  const paths: Array<{ d: string }> = [];
  model.rows.forEach((row) => {
    row.items.forEach((it) => {
      const deps = Array.isArray(it.deps) ? it.deps : [];
      deps.forEach((d: any) => {
        const type = (d?.type || 'FS');
        if (type !== 'FS') return; // implement FS first
        const predId = Number(d?.depends_on?.id ?? d?.depends_on_task_id ?? d?.id);
        if (!predId) return;
        const pred = pos.get(predId);
        const succ = pos.get(it.id);
        if (!pred || !succ) return;
        const x1 = pred.x + pred.w;
        const y1 = pred.cy;
        const x2 = succ.x;
        const y2 = succ.cy;
        const midX = x1 + 8; // small horizontal then vertical
        const dAttr = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
        paths.push({ d: dAttr });
      });
    });
  });

  const totalHeight = rowHeights.reduce((a, b) => a + b, 0);
  return (
    <svg className="pointer-events-none absolute left-0" style={{ top: 8 }} width={gridDays * pxPerDay} height={totalHeight}>
      <g stroke="#9ca3af" strokeWidth={1.5} fill="none">
        {paths.map((p, i) => (
          <path key={i} d={p.d} markerEnd={undefined} />
        ))}
      </g>
    </svg>
  );
}
