/**
 * UAE public holidays 2026 -- real dates, looked up rather than guessed
 * (training data on Islamic-calendar holiday dates years out is
 * unreliable). Fixed-date holidays (New Year's Day, Commemoration Day,
 * National Day) are confirmed; Islamic-calendar holidays (Eid al-Fitr,
 * Arafat Day, Eid al-Adha, Islamic New Year, Prophet Muhammad's Birthday)
 * are projected/as-announced and subject to UAE authorities' official
 * moon-sighting confirmation, which can shift them by a day or two --
 * flagged per-entry below, not presented as equally certain.
 *
 * This is the deterministic half of "identify holidays" -- a static,
 * sourced list shown on the calendar view. A genuine AI-driven "watch for
 * relevant industry events too" layer is a different, bigger feature (see
 * PROGRESS-integration.md roadmap notes) and isn't what this is.
 *
 * Source: UAE public holiday coverage for 2026 (Time Out Dubai, GreytHR,
 * RadixHR and others), retrieved 2026-08-14.
 */
export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
  confirmed: boolean;
}

export const UAE_HOLIDAYS_2026: Holiday[] = [
  { date: "2026-01-01", name: "New Year's Day", confirmed: true },
  { date: "2026-03-19", name: "Eid Al Fitr (start, projected)", confirmed: false },
  { date: "2026-03-20", name: "Eid Al Fitr", confirmed: false },
  { date: "2026-03-21", name: "Eid Al Fitr", confirmed: false },
  { date: "2026-05-26", name: "Arafat Day (projected)", confirmed: false },
  { date: "2026-05-27", name: "Eid Al Adha (start, projected)", confirmed: false },
  { date: "2026-05-28", name: "Eid Al Adha", confirmed: false },
  { date: "2026-05-29", name: "Eid Al Adha", confirmed: false },
  { date: "2026-06-16", name: "Islamic New Year (projected)", confirmed: false },
  { date: "2026-08-25", name: "Prophet Muhammad's Birthday (projected)", confirmed: false },
  { date: "2026-12-01", name: "Commemoration Day", confirmed: true },
  { date: "2026-12-02", name: "UAE National Day", confirmed: true },
  { date: "2026-12-03", name: "UAE National Day", confirmed: true },
];

export function holidaysForMonth(monthStart: string): Holiday[] {
  const prefix = monthStart.slice(0, 7); // "YYYY-MM"
  return UAE_HOLIDAYS_2026.filter((h) => h.date.startsWith(prefix));
}

export function holidayOnDate(dateIso: string): Holiday | undefined {
  return UAE_HOLIDAYS_2026.find((h) => h.date === dateIso);
}
