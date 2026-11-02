"use client";

import { useState } from "react";
import { fmt, num } from "./format";
import { Clip, curvePath, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { discriminant, isZeroPolynomial, realRoots } from "./discriminant-math";
import { numProp, type WidgetProps } from "./types";

const F: Frame = { xMin: -6, xMax: 6, yMin: -8, yMax: 8, left: 18, top: 10, width: 324, height: 240 };

export type DiscriminantState = { a: number; b: number; c: number };

export function renderDiscriminantSvg(alt: string, { a, b, c }: DiscriminantState) {
  const roots = realRoots(a, b, c).filter((r) => r >= F.xMin && r <= F.xMax);
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={F} labelEvery={2} />
      <Clip f={F}>
        <path d={curvePath(F, (x) => a * x * x + b * x + c, F.xMin, F.xMax)} fill="none" stroke="var(--cobalt)" strokeWidth="2.6" />
        {roots.map((r) => (
          <g key={r}>
            <circle cx={sx(F, r)} cy={sy(F, 0)} r="5" fill="var(--t5-ink)" />
            <text x={sx(F, r)} y={sy(F, 0) - 9} fontSize="11" textAnchor="middle" fill="var(--ink)">{fmt(r)}</text>
          </g>
        ))}
      </Clip>
    </svg>
  );
}

function summary(a: number, b: number, c: number) {
  if (isZeroPolynomial(a, b, c)) return { delta: "undefined", count: "a = 0 and b = 0 and c = 0, so every x satisfies 0 = 0", roots: "every real number" };
  if (a === 0) return { delta: "undefined", count: b === 0 ? "a = 0 and b = 0, so y is the constant c, which is never 0" : "a = 0, so this is a straight line, not a quadratic", roots: b === 0 ? "none" : fmt(-c / b) };
  const d = discriminant(a, b, c);
  const roots = realRoots(a, b, c);
  const count = d > 1e-9 ? "2 distinct real roots" : d < -1e-9 ? "no real roots" : "1 repeated real root";
  return { delta: fmt(d), count, roots: roots.length ? roots.map((r) => fmt(r)).join(", ") : "none" };
}

export default function DiscriminantRoots({ alt, props }: WidgetProps) {
  const [s, setS] = useState<DiscriminantState>({
    a: numProp(props, "a", 1, -3, 3),
    b: numProp(props, "b", -3, -6, 6),
    c: numProp(props, "c", 2, -6, 6),
  });
  const set = (k: keyof DiscriminantState) => (v: number) => setS((p) => ({ ...p, [k]: v }));
  const out = summary(s.a, s.b, s.c);
  return (
    <WidgetFrame
      id="discriminant-roots"
      title="Discriminant and roots"
      hint="Drag the sliders"
      caption="The roots are where the curve crosses the x-axis. Δ tells you how many there are before you solve anything."
      svg={renderDiscriminantSvg(alt, s)}
    >
      <p>y = {s.a === 1 ? "" : s.a === -1 ? "−" : num(s.a)}x² {s.b < 0 ? "−" : "+"} {num(Math.abs(s.b))}x {s.c < 0 ? "−" : "+"} {num(Math.abs(s.c))}</p>
      <p>Δ = b² − 4ac = <output aria-live="off" data-testid="delta">{out.delta}</output></p>
      <p><output aria-live="polite" data-testid="root-count">{out.count}</output></p>
      <p>Roots: <output aria-live="off" data-testid="roots">{out.roots}</output></p>
      <Slider label="a" value={s.a} min={-3} max={3} step={0.25} onChange={set("a")} format={num} />
      <Slider label="b" value={s.b} min={-6} max={6} step={0.5} onChange={set("b")} format={num} />
      <Slider label="c" value={s.c} min={-6} max={6} step={0.5} onChange={set("c")} format={num} />
    </WidgetFrame>
  );
}
