import { MOU_EXPIRING_SOON_DAYS } from "../config/limits.js";
import type { MouTerm } from "./types.js";

export type MouUrgency = "overdue" | "expiring_soon" | "in_force" | "not_yet_active" | "closed";

/**
 * Pure function (no DB/clock injection needed beyond `now`) so this is
 * unit-testable without a database -- the actual "what's expiring soon"
 * query (listMousExpiringSoon) does the equivalent filter in SQL for real
 * usage; this is what the CLI's compliance view uses to label/sort rows it
 * already has in hand, and what the matching/renewal logic can reuse.
 */
export function mouUrgency(term: Pick<MouTerm, "term_start" | "term_end" | "status">, now: Date = new Date()): MouUrgency {
  if (term.status === "terminated" || term.status === "renewed") return "closed";

  const todayMs = startOfDay(now).getTime();
  const startMs = startOfDay(new Date(term.term_start)).getTime();
  const endMs = startOfDay(new Date(term.term_end)).getTime();

  if (term.status === "expired" || endMs < todayMs) return "overdue";
  if (startMs > todayMs) return "not_yet_active";

  const daysToExpiry = Math.round((endMs - todayMs) / (24 * 60 * 60 * 1000));
  if (daysToExpiry <= MOU_EXPIRING_SOON_DAYS) return "expiring_soon";
  return "in_force";
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
