import { sx, sy, type Frame } from "./shared";

/** Baseline plus labelled ticks along the bottom of a Frame whose yMin is 0. */
export function BaseAxis({ f, ticks, gridY = [] }: { f: Frame; ticks: { x: number; label: string }[]; gridY?: { y: number; label: string }[] }) {
  const y0 = sy(f, 0);
  return (
    <g fontSize="10" fill="var(--muted)">
      {gridY.map((t) => (
        <g key={t.y}>
          <line x1={f.left} y1={sy(f, t.y)} x2={f.left + f.width} y2={sy(f, t.y)} stroke="var(--line)" strokeWidth="1" />
          <text x={f.left - 4} y={sy(f, t.y) + 3} textAnchor="end">{t.label}</text>
        </g>
      ))}
      <line x1={f.left} y1={y0} x2={f.left + f.width} y2={y0} stroke="var(--muted)" strokeWidth="1.2" />
      {ticks.map((t) => (
        <g key={t.x}>
          <line x1={sx(f, t.x)} y1={y0} x2={sx(f, t.x)} y2={y0 + 3} stroke="var(--muted)" />
          <text x={sx(f, t.x)} y={y0 + 13} textAnchor="middle">{t.label}</text>
        </g>
      ))}
    </g>
  );
}

/** Closed path under y = fn(x) from x0 to x1 down to the x-axis (for shading). */
export function areaUnder(f: Frame, fn: (x: number) => number, x0: number, x1: number, n = 120): string {
  if (!(x1 > x0)) return "";
  let d = `M${sx(f, x0).toFixed(1)} ${sy(f, 0).toFixed(1)}`;
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    d += `L${sx(f, x).toFixed(1)} ${sy(f, fn(x)).toFixed(1)}`;
  }
  return `${d}L${sx(f, x1).toFixed(1)} ${sy(f, 0).toFixed(1)}Z`;
}
