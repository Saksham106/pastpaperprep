"use client";

import { useState, type SVGProps } from "react";
import { fmt, num } from "./format";
import { Clip, curvePath, Grid, pointerToSvg, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { DRAG_START, FIXED_POINTS, regression, type Pt } from "./regression-math";
import { numProp, type WidgetProps } from "./types";

const F: Frame = { xMin: 0, xMax: 7, yMin: 0, yMax: 7, left: 28, top: 10, width: 322, height: 232 };
const LIM = { lo: 0.5, hi: 6.5 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

/** "y = 0.9x + 1.3" style equation with a true minus sign. */
export function lineEquation(lhs: "y" | "x", rhs: "x" | "y", slope: number, intercept: number): string {
  const sign = Number(intercept.toFixed(2)) < 0 ? "−" : "+";
  return `${lhs} = ${num(slope)}${rhs} ${sign} ${num(Math.abs(intercept))}`;
}

export function renderRegressionSvg(alt: string, drag: Pt, dragProps?: SVGProps<SVGCircleElement>) {
  const pts = [...FIXED_POINTS, drag];
  const s = regression(pts);
  const yOnX = (x: number) => s.m * x + s.c;
  // x on y is x = c2 + d·y, so draw it by stepping through y.
  const xOnY = `M${sx(F, s.c2 + s.d * F.yMin).toFixed(1)} ${sy(F, F.yMin).toFixed(1)}L${sx(F, s.c2 + s.d * F.yMax).toFixed(1)} ${sy(F, F.yMax).toFixed(1)}`;
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={F} />
      <Clip f={F}>
        <path d={curvePath(F, yOnX, F.xMin, F.xMax, 2)} fill="none" stroke="var(--t1-ink)" strokeWidth="2.4" />
        <path d={xOnY} fill="none" stroke="var(--t5-ink)" strokeWidth="2.4" strokeDasharray="6 4" />
        {FIXED_POINTS.map((p) => <circle key={`${p.x}-${p.y}`} cx={sx(F, p.x)} cy={sy(F, p.y)} r="5" fill="var(--ink)" />)}
        <circle cx={sx(F, s.xbar)} cy={sy(F, s.ybar)} r="4" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5" />
        <circle cx={sx(F, drag.x)} cy={sy(F, drag.y)} r="8" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.6" style={{ cursor: "grab", touchAction: "none" }} {...dragProps} />
      </Clip>
      <g fontSize="11">
        <text x={F.left + 8} y="26" fill="var(--t1-ink)">y on x (solid)</text>
        <text x={F.left + 8} y="40" fill="var(--t5-ink)">x on y (dashed)</text>
        <text x={F.left + 8} y="54" fill="var(--muted)">small ring: (x̄, ȳ)</text>
      </g>
    </svg>
  );
}

export default function RegressionTwoLines({ alt, props }: WidgetProps) {
  const [pt, setPt] = useState<Pt>(() => ({
    x: numProp(props, "x", DRAG_START.x, LIM.lo, LIM.hi),
    y: numProp(props, "y", DRAG_START.y, LIM.lo, LIM.hi),
  }));
  const s = regression([...FIXED_POINTS, pt]);

  const dragProps: SVGProps<SVGCircleElement> = {
    onPointerDown: (e) => e.currentTarget.setPointerCapture(e.pointerId),
    onPointerMove: (e) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const { x: px, y: py } = pointerToSvg(e, e.currentTarget);
      const x = F.xMin + ((px - F.left) / F.width) * (F.xMax - F.xMin);
      const y = F.yMax - ((py - F.top) / F.height) * (F.yMax - F.yMin);
      setPt({ x: clamp(r1(x), LIM.lo, LIM.hi), y: clamp(r1(y), LIM.lo, LIM.hi) });
    },
  };

  const eqYX = lineEquation("y", "x", s.m, s.c);
  const eqXY = lineEquation("x", "y", s.d, s.c2);
  return (
    <WidgetFrame
      id="regression-two-lines"
      title="Two regression lines"
      hint="Drag the ringed point or use the sliders"
      caption="Use the y on x line to predict y from a given x, and the x on y line to predict x from a given y. Both pass through (x̄, ȳ), and they coincide only when r = ±1."
      svg={renderRegressionSvg(alt, pt, dragProps)}
    >
      <Slider label="x of the ringed point" value={pt.x} min={LIM.lo} max={LIM.hi} step={0.1} onChange={(x) => setPt((q) => ({ ...q, x }))} format={(v) => fmt(v, 1)} />
      <Slider label="y of the ringed point" value={pt.y} min={LIM.lo} max={LIM.hi} step={0.1} onChange={(y) => setPt((q) => ({ ...q, y }))} format={(v) => fmt(v, 1)} />
      <p>Mean point (x̄, ȳ) = (<output data-testid="mean">{fmt(s.xbar, 2)}, {fmt(s.ybar, 2)}</output>)</p>
      <p>y on x: <output data-testid="yx">{eqYX}</output></p>
      <p>x on y: <output data-testid="xy">{eqXY}</output></p>
      <p>Pearson&apos;s r = <output data-testid="result" aria-live="polite">{fmt(s.r, 3)} (y on x: {eqYX}; x on y: {eqXY})</output></p>
    </WidgetFrame>
  );
}
