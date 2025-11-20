"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { listByTask as listTaskBaselines } from "@/lib/api/task-baselines";
import type { Task } from "@/types/task";
import type { Milestone } from "@/types/milestone";
import type { ProjectBaseline } from "@/types/project-baseline";
import { ChevronLeft } from "lucide-react";

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
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [showPhaseStarts, setShowPhaseStarts] = useState<boolean>(true);
  const [showTaskBaselines, setShowTaskBaselines] = useState<boolean>(false);
  const [taskBaselineMap, setTaskBaselineMap] = useState<Record<number, { start: Date; end: Date } | undefined>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const model = useMemo(() => buildModel(tasks, milestones), [tasks, milestones]);

  const gridDays = Math.max(1, daysDiffInclusive(model.startDate, model.endDate));
  const HEADER_WEEK_H = 22;
  const HEADER_DAY_H = 26;
  const HEADER_TOTAL_H = HEADER_WEEK_H + HEADER_DAY_H;
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

  // Lazy-fetch task baselines when toggled on
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!showTaskBaselines) return;
      const latestBaselineId = Array.isArray(baselines) && baselines.length ? Number(baselines[0].id) : undefined;
      const map: Record<number, { start: Date; end: Date } | undefined> = {};
      for (const t of tasks) {
        const id = Number((t as any)?.id);
        if (!Number.isFinite(id)) continue;
        try {
          const list = await listTaskBaselines(id);
          let chosen: any = undefined;
          if (latestBaselineId) {
            chosen = (list || []).find((b: any) => Number(b?.baseline_id) === latestBaselineId);
          }
          if (!chosen) {
            chosen = (list || []).slice().sort((a: any, b: any) => (Date.parse(b?.created_at || b?.taken_at || '') || 0) - (Date.parse(a?.created_at || a?.taken_at || '') || 0) || (Number(b?.id || 0) - Number(a?.id || 0)))[0];
          }
          if (chosen?.start_planned_base && chosen?.end_planned_base) {
            map[id] = { start: toDateOnly(chosen.start_planned_base), end: toDateOnly(chosen.end_planned_base) };
          } else {
            map[id] = undefined;
          }
        } catch {
          map[id] = undefined;
        }
      }
      if (!cancelled) setTaskBaselineMap(map);
    }
    run();
    return () => { cancelled = true; };
  }, [showTaskBaselines, tasks, baselines]);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-secondary">
        <div className="text-sm text-muted-foreground">
          Range: {fmt(model.startDate)} – {fmt(model.endDate)} • Tasks with dates: {model.rows.reduce((n, r) => n + r.items.length, 0)}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-sm hover:bg-muted transition-colors"
          >
            <ChevronLeft
              className={
                "h-3.5 w-3.5 transition-transform " +
                (sidebarCollapsed ? "rotate-180" : "")
              }
            />
            <span className="hidden sm:inline">
              {sidebarCollapsed ? "Show list" : "Hide list"}
            </span>
          </button>
          <label className="inline-flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" className="h-4 w-4" checked={showDeps} onChange={(e) => setShowDeps(e.target.checked)} />
            <span>Dependencies</span>
          </label>
          <label className="inline-flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" className="h-4 w-4" checked={showPhaseStarts} onChange={(e) => setShowPhaseStarts(e.target.checked)} />
            <span>Phase Starts</span>
          </label>
          <label className="inline-flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" className="h-4 w-4" checked={showTaskBaselines} onChange={(e) => setShowTaskBaselines(e.target.checked)} />
            <span>Task Baselines</span>
          </label>
          {/* Milestone links removed per request */}
          <label className="text-muted-foreground">Zoom</label>
          <select value={zoom} onChange={(e) => setZoom(e.target.value as Zoom)} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
            <option value="day">Day</option>
            <option value="week">Week</option>
          </select>
          <div className="hidden md:flex items-center gap-3 pl-2">
            {[
              { key: 'Planned', status: '' },
              { key: 'In Progress', status: 'progress' },
              { key: 'Done', status: 'done' },
              { key: 'On Hold', status: 'hold' },
            ].map((it) => {
              const c = colorForStatus(it.status);
              return (
                <div key={it.key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full border" style={{ backgroundColor: c.bg, borderColor: c.fg }} />
                  <span>{it.key}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div
          className={
            "shrink-0 border-r bg-card overflow-hidden transition-all duration-200 " +
            (sidebarCollapsed ? "w-0" : "w-80")
          }
        >
          <div className="h-9 px-3 flex items-center text-xs text-muted-foreground border-b">Milestone / Task</div>
          <div>
            {model.rows.map((row, idx) => (
              <div key={row.id} className="border-b">
                <div className="px-3 py-2 text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: colorForIndex(idx) }} />
                  <span className="truncate" title={row.name}>{row.name}</span>
                </div>
                {row.items.map((it) => (
                  <div key={it.id} className="px-3 py-1 text-xs text-muted-foreground truncate">{it.title}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div ref={scrollRef} className="relative min-w-0 overflow-x-auto flex-1">
          {/* Header grid: Weeks + Days */}
          <div className="relative" style={{ width: totalWidth }}>
            {/* Weeks row */}
            <div className="flex border-b bg-secondary/60" style={{ height: HEADER_WEEK_H }}>
              {buildWeekSegments(model.startDate, model.endDate).map((seg, idx) => {
                const segPx = seg.span * pxPerDay;
                const label = segPx < 48 ? seg.label.replace('Week ', 'W ') : seg.label;
                return (
                  <div
                    key={idx}
                    className="h-full border-r text-[11px] text-muted-foreground flex items-center px-2 select-none whitespace-nowrap overflow-hidden text-ellipsis"
                    style={{ width: segPx }}
                    title={seg.label}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            {/* Days row */}
            <div className="flex border-b bg-secondary/40" style={{ height: HEADER_DAY_H }}>
              {Array.from({ length: gridDays }).map((_, i) => (
                <div key={i} className="h-full border-r text-[10px] text-muted-foreground grid place-items-center select-none whitespace-nowrap" style={{ width: pxPerDay }}>
                  {labelForOffset(model.startDate, i)}
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
                  <div className="absolute left-0 right-0" style={{ top: HEADER_TOTAL_H, bottom: 0 }}>
                    <div
                      className="absolute h-full border-x-2"
                      style={{ left, width, backgroundColor: 'color-mix(in oklab, var(--primary) 12%, transparent)', borderColor: 'color-mix(in oklab, var(--primary) 55%, transparent)' }}
                      title={`Baseline: ${fmt(start)} – ${fmt(end)}`}
                    />
                  </div>
                );
              })()
            )}

            {/* Grid rows + bars */}
            <div>
              {model.rows.map((row, rowIdx) => (
                <div
                  key={row.id}
                  className="relative border-b"
                  style={{
                    height: Math.max(24, row.items.length * 22 + 12),
                    background: rowIdx % 2 === 0 ? 'var(--card)' : 'color-mix(in oklab, var(--muted) 30%, transparent)'
                  }}
                  onMouseEnter={() => setHoverRow(rowIdx)}
                  onMouseLeave={() => setHoverRow((v) => (v === rowIdx ? null : v))}
                >
                  {/* light grid */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="flex h-full">
                      {Array.from({ length: gridDays }).map((_, i) => (
                        <div key={i} className={"border-r " + (i % 7 === 0 ? "bg-secondary/40" : "bg-card")} style={{ width: pxPerDay }} />
                      ))}
                    </div>
                  </div>

                  {/* milestone marker: centered diamond on due date */}
                  {row.due && inRange(row.due, model.startDate, model.endDate) && (() => {
                    const centerX = daysBetween(model.startDate!, row.due) * pxPerDay + Math.floor(pxPerDay / 2);
                    const color = colorForIndex(rowIdx);
                    const size = Math.max(8, Math.min(12, pxPerDay - 4));
                    const left = centerX - Math.floor(size / 2);
                    const top = `calc(50% - ${Math.floor(size / 2)}px)`;
                    return (
                      <div className="absolute" style={{ left, top, zIndex: 25 }} title={`Milestone due • ${row.name} • ${fmt(row.due)}`}>
                        <div
                          className="rounded-[2px]"
                          style={{ width: size, height: size, transform: 'rotate(45deg)', backgroundColor: 'var(--card)', border: `1.5px solid ${color}` }}
                        />
                      </div>
                    );
                  })()}

                  {/* hybrid: phase start marker (dashed grey) or fallback main colored if no due */}
                  {row.span && inRange(row.span.start, model.startDate, model.endDate) && (() => {
                    const left = daysBetween(model.startDate!, row.span!.start) * pxPerDay;
                    const hasDue = Boolean(row.due);
                    // avoid duplicate marker if phase start equals due date
                    if (hasDue && row.due && toDateOnly(row.due).getTime() === toDateOnly(row.span!.start).getTime()) {
                      return null;
                    }
                    if (hasDue) {
                      if (!showPhaseStarts) return null;
                      return (
                        <div className="absolute inset-y-0" style={{ left, zIndex: 19 }} title={`Phase start • ${row.name} • ${fmt(row.span!.start)}`}>
                          <div className="h-full border-r border-dashed" style={{ borderRightColor: 'var(--border)', borderRightWidth: 1 }} />
                        </div>
                      );
                    }
                    // Fallback: no due date => use phase start as main colored marker
                    const color = colorForIndex(rowIdx);
                    return (
                      <div className="absolute inset-y-0" style={{ left, zIndex: 20 }}>
                        <div className="h-full" style={{ width: 2, backgroundColor: color }} title={`Phase start • ${row.name} • ${fmt(row.span!.start)}`} />
                      </div>
                    );
                  })()}

                  {/* bars */}
                  <div className="relative">
                    {row.items.map((it, idx) => {
                      if (!it.start || !it.end) return null;
                      const x = daysBetween(model.startDate!, it.start) * pxPerDay;
                      const w = Math.max(pxPerDay, daysDiffInclusive(it.start, it.end) * pxPerDay);
                      const y = 8 + idx * 22;
                      const progress = Math.max(0, Math.min(100, it.percent || 0));
                      const color = colorForIndex(rowIdx);
                      const barBase = colorForStatus((it as any)?.status ?? '');
                      const durationDays = daysDiffInclusive(it.start, it.end);
                      const tooltip = `${it.title}\n${fmt(it.start)} – ${fmt(it.end)} (${durationDays} day${durationDays>1?'s':''})\nMilestone: ${row.name}\nProgress: ${progress}%`;
                      return (
                        <a key={it.id} href={`/dashboard/tasks/${it.id}`} className="absolute block rounded-full transition-colors shadow-sm"
                           style={{ left: x, top: y, width: w, height: 16, backgroundColor: barBase.bg, border: `1px solid ${barBase.border}` }} title={tooltip}>
                          <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: 4, backgroundColor: color }} />
                          <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: barBase.fg }} />
                          {w >= 56 && (
                            <span className="absolute inset-0 hidden md:flex items-center pointer-events-none">
                              <span className="pl-1.5 pr-1 text-[10px] font-medium" style={{ color: barBase.fg }}>{progress}%</span>
                            </span>
                          )}
                        </a>
                      );
                    })}
                    {showTaskBaselines && row.items.map((it, idx) => {
                      const id = Number((it as any)?.id);
                      const snap = taskBaselineMap[id];
                      if (!snap || !model.startDate) return null;
                      const bx = daysBetween(model.startDate!, snap.start) * pxPerDay;
                      const bw = Math.max(pxPerDay, daysDiffInclusive(snap.start, snap.end) * pxPerDay);
                      const by = 8 + idx * 22 + 18; // below main bar
                      return (
                        <div key={`ghost-${id}`} className="absolute rounded-full"
                          style={{ left: bx, top: by, width: bw, height: 6, backgroundColor: 'transparent', border: '1px dashed #6366f1', opacity: 0.9 }}
                          title={`Baseline: ${fmt(snap.start)} – ${fmt(snap.end)}`} />
                      );
                    })}
                  </div>

                  {/* milestone summary span pill */}
                  {row.span && model.startDate && model.endDate && hoverRow === rowIdx && (() => {
                    const x = daysBetween(model.startDate!, row.span!.start) * pxPerDay;
                    const w = Math.max(pxPerDay, row.span!.days * pxPerDay);
                    const color = colorForIndex(rowIdx);
                    return (
                      <div className="absolute" style={{ left: x, top: -18 }}>
                        <div className="text-[11px] px-2 py-0.5 rounded-full border bg-background" style={{ borderColor: color, color }}>
                          {row.name} • {fmt(row.span!.start)} – {fmt(row.span!.end)} • {row.span!.days}d
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            {/* Dependencies overlay (FS only for now) */}
            {showDeps && (
              <DependenciesOverlay model={model} gridDays={gridDays} pxPerDay={pxPerDay} headerOffset={HEADER_TOTAL_H} />
            )}

            {/* Milestone link arrows removed as requested */}

            {/* Today line */}
            {todayX !== null && (
              <div className="pointer-events-none absolute" style={{ left: todayX, top: HEADER_TOTAL_H, bottom: 0 }}>
                <div className="w-[2px] h-full bg-primary/70" />
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

function buildWeekSegments(start: Date | null, end: Date | null): Array<{ span: number; label: string }> {
  if (!start || !end) return [];
  const segments: Array<{ span: number; label: string }> = [];
  let cur = new Date(start);
  let idx = 1;
  while (cur <= end) {
    const startOfSeg = new Date(cur);
    const daysLeft = Math.max(1, Math.floor((end.getTime() - startOfSeg.getTime()) / 86400000) + 1);
    // segment ends at the nearest next Sunday (day=0) relative to current
    const dow = startOfSeg.getDay(); // 0=Sun ... 6=Sat
    const span = Math.min(daysLeft, dow === 0 ? 7 : 7 - dow);
    segments.push({ span, label: `Week ${idx}` });
    cur.setDate(cur.getDate() + span);
    idx += 1;
  }
  return segments;
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
  const byMilestone: Record<string, { id: string; name: string; due: Date | null; items: Array<{ id: number; title: string; start: Date | null; end: Date | null; percent: number; deps?: any[]; status?: string }>; span?: { start: Date; end: Date; days: number } }> = {};
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
      status: (t as any)?.status || '',
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

  // compute milestone span from min(start) to max(end) among tasks
  for (const r of rows) {
    const starts = r.items.map(i => i.start).filter(Boolean) as Date[];
    const ends = r.items.map(i => i.end).filter(Boolean) as Date[];
    if (starts.length && ends.length) {
      const s = new Date(Math.min(...starts.map(d => d.getTime())));
      const e = new Date(Math.max(...ends.map(d => d.getTime())));
      r.span = { start: s, end: e, days: daysDiffInclusive(s, e) };
    }
  }

  return { startDate, endDate, rows };
}

// Theme-based palette for milestones (uses CSS variables, falls back to neutral if missing)
function colorForIndex(i: number) {
  const palette = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
  ];
  return palette[i % palette.length] || 'var(--primary)';
}

// CSV export removed per request

function colorForStatus(status: string | undefined) {
  const s = (status || '').toLowerCase();
  // Use theme tokens; backgrounds are soft via color-mix for readability
  if (s.includes('progress')) return {
    bg: 'color-mix(in oklab, var(--chart-5) 28%, transparent)',
    border: 'var(--chart-5)',
    fg: 'var(--chart-5)'
  };
  if (s.includes('done') || s.includes('selesai')) return {
    bg: 'color-mix(in oklab, var(--chart-2) 22%, transparent)',
    border: 'var(--chart-2)',
    fg: 'var(--chart-2)'
  };
  if (s.includes('hold')) return {
    bg: 'color-mix(in oklab, var(--destructive) 22%, transparent)',
    border: 'var(--destructive)',
    fg: 'var(--destructive)'
  };
  return {
    bg: 'var(--muted)',
    border: 'var(--border)',
    fg: 'var(--muted-foreground)'
  };
}

// Draw FS dependencies between tasks
function DependenciesOverlay({ model, gridDays, pxPerDay, headerOffset }: { model: ReturnType<typeof buildModel>; gridDays: number; pxPerDay: number; headerOffset: number }) {
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
    <svg className="pointer-events-none absolute left-0" style={{ top: headerOffset }} width={gridDays * pxPerDay} height={totalHeight}>
      <defs>
        <marker id="arrow-grey" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>
      <g strokeWidth={1.25} fill="none" strokeOpacity={0.7} color="var(--muted-foreground)" stroke="currentColor">
        {paths.map((p, i) => (
          <path key={i} d={p.d} markerEnd="url(#arrow-grey)" />
        ))}
      </g>
    </svg>
  );
}

// Link the latest finishing task in a milestone to its milestone diamond date
function MilestoneLinksOverlay({ model, gridDays, pxPerDay, headerOffset }: { model: ReturnType<typeof buildModel>; gridDays: number; pxPerDay: number; headerOffset: number }) {
  // layout positions
  let yAcc = 0;
  const rowHeights = model.rows.map(r => Math.max(24, r.items.length * 22 + 12));
  const pos = new Map<number, { x: number; w: number; cy: number }>();
  model.rows.forEach((row, rIdx) => {
    const rowTop = yAcc;
    row.items.forEach((it, idx) => {
      if (!it.start || !it.end) return;
      const x = daysBetween(model.startDate!, it.start) * pxPerDay;
      const w = Math.max(pxPerDay, daysDiffInclusive(it.start, it.end) * pxPerDay);
      const y = rowTop + 8 + idx * 22 + 7;
      pos.set(it.id, { x, w, cy: y });
    });
    yAcc += rowHeights[rIdx];
  });

  const paths: Array<{ d: string; color: string; xEnd: number; yEnd: number }> = [];
  // choose candidate task per milestone and connect to milestone diamond
  yAcc = 0;
  model.rows.forEach((row, rIdx) => {
    const rowTop = yAcc;
    const rowH = rowHeights[rIdx];
    yAcc += rowH;
    if (!row.due) return;
    // compute diamond center
    const xDiamond = daysBetween(model.startDate!, row.due) * pxPerDay + Math.floor(pxPerDay / 2);
    const yDiamond = (rowTop) + Math.floor(rowH / 2);
    // find last task ending at/before due; fallback to latest end
    const candidates = row.items.filter(it => it.start && it.end);
    if (candidates.length === 0) return;
    let chosen = candidates
      .filter(it => (it.end!.getTime() <= row.due!.getTime()))
      .sort((a, b) => (b.end!.getTime() - a.end!.getTime()))[0];
    if (!chosen) {
      chosen = candidates.slice().sort((a, b) => (b.end!.getTime() - a.end!.getTime()))[0];
    }
    const anchor = pos.get(chosen.id);
    if (!anchor) return;
    const x1 = anchor.x + anchor.w;
    const y1 = anchor.cy;
    const midX = x1 + 8;
    const dAttr = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${yDiamond} L ${xDiamond - 6} ${yDiamond}`;
    paths.push({ d: dAttr, color: colorForIndex(rIdx), xEnd: xDiamond, yEnd: yDiamond });
  });

  const totalHeight = rowHeights.reduce((a, b) => a + b, 0);
  return (
    <svg className="pointer-events-none absolute left-0" style={{ top: headerOffset }} width={gridDays * pxPerDay} height={totalHeight}>
      <defs>
        <marker id="arrow-colored" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>
      {paths.map((p, i) => (
        <g key={i} stroke={p.color} strokeWidth={1.1} fill="none" strokeOpacity={0.8} color={p.color}>
          <path d={p.d} markerEnd="url(#arrow-colored)" />
        </g>
      ))}
    </svg>
  );
}
