import type { ReportingPeriod } from "@/types/reporting-period";

export type PeriodGranularity = "daily" | "weekly" | "monthly";

export type AsOfPeriodOption = {
  id: number;
  period_date: string; // YYYY-MM-DD
  label: string;
  note: string | null;
  group_key: string;
  source: ReportingPeriod;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseYmdToUtcDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

function isoWeekOfUtcDate(date: Date): { isoYear: number; isoWeek: number } {
  // ISO week calculation in UTC
  const dt = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = dt.getUTCDay() || 7; // 1..7 (Mon..Sun)
  dt.setUTCDate(dt.getUTCDate() + 4 - day); // nearest Thursday
  const isoYear = dt.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const diffDays =
    Math.floor((dt.getTime() - yearStart.getTime()) / 86400000) + 1;
  const isoWeek = Math.ceil(diffDays / 7);
  return { isoYear, isoWeek };
}

export function groupKeyForPeriodDate(
  periodDate: string,
  granularity: PeriodGranularity
): string {
  const dt = parseYmdToUtcDate(periodDate);
  if (!dt) return `${granularity}:invalid`;

  if (granularity === "daily") {
    return dt.toISOString().slice(0, 10);
  }

  if (granularity === "monthly") {
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    return `${y}-${pad2(m)}`;
  }

  const { isoYear, isoWeek } = isoWeekOfUtcDate(dt);
  return `${isoYear}-W${pad2(isoWeek)}`;
}

function labelForGroup(
  groupKey: string,
  asOfDate: string,
  granularity: PeriodGranularity
): string {
  if (granularity === "daily") return asOfDate;
  return `${groupKey} (as of ${asOfDate})`;
}

/**
 * daily: each date is a period.
 * weekly/monthly: group by ISO week / month, then take the latest period_date as representative (as-of).
 */
export function buildAsOfPeriodOptions(
  periods: ReportingPeriod[],
  granularity: PeriodGranularity
): AsOfPeriodOption[] {
  const list = Array.isArray(periods) ? periods : [];
  const bestByGroup = new Map<string, ReportingPeriod>();

  for (const p of list) {
    const date = String(p.period_date || "").trim();
    if (!date) continue;
    const key = groupKeyForPeriodDate(date, granularity);
    const prev = bestByGroup.get(key);
    if (!prev) {
      bestByGroup.set(key, p);
      continue;
    }
    const prevDate = String(prev.period_date || "").trim();
    if (date > prevDate) {
      bestByGroup.set(key, p);
    } else if (date === prevDate) {
      const pid = Number(p.id ?? 0);
      const previd = Number(prev.id ?? 0);
      if (pid > previd) bestByGroup.set(key, p);
    }
  }

  const options: AsOfPeriodOption[] = [];
  for (const [group_key, p] of bestByGroup.entries()) {
    const date = String(p.period_date || "").trim();
    const id = Number(p.id ?? NaN);
    if (!Number.isFinite(id) || !date) continue;
    options.push({
      id,
      period_date: date,
      label: labelForGroup(group_key, date, granularity),
      note: p.note ?? null,
      group_key,
      source: p,
    });
  }

  // Sort newest first for dropdowns.
  options.sort((a, b) => {
    if (b.period_date !== a.period_date) {
      return b.period_date.localeCompare(a.period_date);
    }
    return (b.id ?? 0) - (a.id ?? 0);
  });

  return options;
}
