/**
 * Deterministic pace/forecast projection for a goal -- template-computed
 * from real logged entries, not an AI call (same reasoning as
 * apps/social-assistant/src/lib/ai/caption.ts: no budget-governor gate
 * needed because nothing here calls a paid model). Answers "at this rate,
 * where do we land, and what would it take to hit target" -- the numbers
 * behind the human-readable note rendered on the goal detail page.
 */
import type { Goal, GoalProgressEntry } from "@mira/shared-types";
import { formatDate, formatNumber } from "./utils";

export interface DailyPoint {
  date: string;
  value: number;
  cumulative: number;
}

export interface Forecast {
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  pacePerDay: number;
  projectedTotal: number;
  projectedPercent: number;
  onTrack: boolean;
  extraPerDayNeeded: number;
  series: DailyPoint[];
  note: string;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeForecast(goal: Goal, entries: GoalProgressEntry[], totalLogged: number): Forecast {
  const today = todayIso();
  const daysTotal = Math.max(1, daysBetween(goal.period_start, goal.period_end) + 1);
  const daysElapsedRaw = daysBetween(goal.period_start, today) + 1;
  const daysElapsed = Math.min(Math.max(daysElapsedRaw, 0), daysTotal);
  const daysRemaining = Math.max(daysTotal - daysElapsed, 0);

  const pacePerDay = daysElapsed > 0 ? totalLogged / daysElapsed : 0;
  const projectedTotal = totalLogged + pacePerDay * daysRemaining;
  const projectedPercent = goal.target_value > 0 ? (projectedTotal / goal.target_value) * 100 : 0;
  const onTrack = projectedTotal >= goal.target_value;

  const remainingToTarget = Math.max(goal.target_value - totalLogged, 0);
  const requiredPacePerDay = daysRemaining > 0 ? remainingToTarget / daysRemaining : remainingToTarget > 0 ? Infinity : 0;
  const extraPerDayNeeded = Math.max(0, requiredPacePerDay - pacePerDay);

  // Cumulative daily series, period_start -> today (or period_end if the
  // period's already over), so a chart can show the real trajectory so far.
  const byDate = new Map<string, number>();
  for (const e of entries) byDate.set(e.entry_date, (byDate.get(e.entry_date) ?? 0) + e.value);
  const chartEnd = daysElapsedRaw > daysTotal ? goal.period_end : today;
  const series: DailyPoint[] = [];
  let cumulative = 0;
  for (let i = 0; i <= daysBetween(goal.period_start, chartEnd); i++) {
    const d = new Date(`${goal.period_start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const value = byDate.get(iso) ?? 0;
    cumulative += value;
    series.push({ date: iso, value, cumulative });
  }

  const unit = goal.unit ? ` ${goal.unit}` : "";
  const endLabel = formatDate(goal.period_end);
  let note: string;
  if (entries.length === 0) {
    note = `No progress logged yet -- log the first entry to start a pace projection.`;
  } else if (daysRemaining === 0) {
    note = onTrack
      ? `Period's over and target was reached -- ${formatNumber(totalLogged)}${unit} of ${formatNumber(goal.target_value)}${unit}.`
      : `Period's over, landed at ${formatNumber(totalLogged)}${unit} of ${formatNumber(goal.target_value)}${unit} (${Math.round((totalLogged / goal.target_value) * 100)}%).`;
  } else if (onTrack) {
    note = `At this pace (${formatNumber(round1(pacePerDay))}${unit}/day), you're on track for ${formatNumber(round1(projectedTotal))}${unit} by ${endLabel} -- ${Math.round(projectedPercent)}% of target.`;
  } else {
    note = `At this pace (${formatNumber(round1(pacePerDay))}${unit}/day), you'd land at ${formatNumber(round1(projectedTotal))}${unit} (${Math.round(projectedPercent)}%) by ${endLabel}. Push ${formatNumber(round1(extraPerDayNeeded))} more${unit}/day to hit target.`;
  }

  return {
    daysTotal,
    daysElapsed,
    daysRemaining,
    pacePerDay: round1(pacePerDay),
    projectedTotal: round1(projectedTotal),
    projectedPercent: round1(projectedPercent),
    onTrack,
    extraPerDayNeeded: round1(extraPerDayNeeded),
    series,
    note,
  };
}
