import type { DailyPoint } from "@/lib/forecast";

interface ForecastChartProps {
  series: DailyPoint[];
  target: number;
  projectedTotal: number;
}

const WIDTH = 480;
const HEIGHT = 140;
const PAD = 8;

/**
 * Plain inline SVG area chart -- no charting library, consistent with how
 * apps/social-assistant's poster generator avoids a dependency for
 * deterministic rendering. Plots cumulative progress so far (solid area) and
 * a dashed line out to the projected total at period end, against a target
 * reference line.
 */
export function ForecastChart({ series, target, projectedTotal }: ForecastChartProps) {
  if (series.length === 0) return null;

  const maxValue = Math.max(target, projectedTotal, ...series.map((p) => p.cumulative), 1);
  const scaleX = (i: number) => PAD + (i / Math.max(series.length - 1, 1)) * (WIDTH - PAD * 2);
  const scaleY = (v: number) => HEIGHT - PAD - (v / maxValue) * (HEIGHT - PAD * 2);

  const linePoints = series.map((p, i) => `${scaleX(i)},${scaleY(p.cumulative)}`).join(" ");
  const areaPoints = `${PAD},${HEIGHT - PAD} ${linePoints} ${scaleX(series.length - 1)},${HEIGHT - PAD}`;

  const lastActual = series[series.length - 1];
  const targetY = scaleY(target);
  const projectedY = scaleY(projectedTotal);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Cumulative progress with target and projection">
      <line x1={PAD} y1={targetY} x2={WIDTH - PAD} y2={targetY} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
      <text x={WIDTH - PAD} y={targetY - 4} textAnchor="end" fontSize="9" fill="currentColor" opacity={0.5}>
        target
      </text>

      <polygon points={areaPoints} fill="currentColor" opacity={0.08} />
      <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth={2} />

      {projectedTotal !== lastActual.cumulative && (
        <line
          x1={scaleX(series.length - 1)}
          y1={scaleY(lastActual.cumulative)}
          x2={WIDTH - PAD}
          y2={projectedY}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.55}
        />
      )}

      <circle cx={scaleX(series.length - 1)} cy={scaleY(lastActual.cumulative)} r={3} fill="currentColor" />
      {projectedTotal !== lastActual.cumulative && (
        <circle cx={WIDTH - PAD} cy={projectedY} r={2.5} fill="currentColor" opacity={0.55} />
      )}
    </svg>
  );
}
