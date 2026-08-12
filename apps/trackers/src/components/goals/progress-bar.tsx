import { clampPercent } from "@/lib/utils";

export function ProgressBar({ percent }: { percent: number }) {
  const pct = clampPercent(percent);
  const overshoot = percent > 100;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] ${overshoot ? "bg-success" : "bg-primary"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
