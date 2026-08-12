import type { GoalProgressEntry } from "@mira/shared-types";
import { formatDate, formatNumber } from "@/lib/utils";

export function EntryHistory({ entries, unit }: { entries: GoalProgressEntry[]; unit: string | null }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No entries logged yet.</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <div className="min-w-0">
            <span className="font-medium">{formatDate(entry.entry_date)}</span>
            {entry.note && <p className="text-xs text-muted-foreground truncate">{entry.note}</p>}
          </div>
          <span className="shrink-0 font-medium tabular-nums">
            {entry.value >= 0 ? "+" : ""}
            {formatNumber(entry.value)} {unit ?? ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
