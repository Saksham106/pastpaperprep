"use client";

import { useState } from "react";
import { fmt, num } from "./format";
import { Clip, curvePath, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { eulerPoints, exactY, STEP_SIZES, X_END } from "./euler-math";
import { numProp, type WidgetProps } from "./types";

const F: Frame = { xMin: -0.15, xMax: 1.15, yMin: -0.5, yMax: 4, left: 28, top: 10, width: 322, height: 232 };

export type EulerState = { h: number };

export function renderEulerSvg(alt: string, { h }: EulerState) {
  const pts = eulerPoints(h);
  const poly = pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(F, p.x).toFixed(1)} ${sy(F, p.y).toFixed(1)}`).join("");
  const end = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={F} />
      <Clip f={F}>
        <line x1={sx(F, X_END)} y1={F.top} x2={sx(F, X_END)} y2={F.top + F.height} stroke="var(--ink-soft)" strokeWidth="1" strokeDasharray="3 3" />
        <path d={curvePath(F, exactY, 0, X_END)} fill="none" stroke="var(--t1-ink)" strokeWidth="2.8" />
        <path d={poly} fill="none" stroke="var(--t5-ink)" strokeWidth="2.2" />
        {pts.map((p) => <circle key={p.x} cx={sx(F, p.x)} cy={sy(F, p.y)} r={pts.length > 12 ? 2.5 : 4} fill="var(--t5-ink)" />)}
        <circle cx={sx(F, X_END)} cy={sy(F, exactY(X_END))} r="5" fill="var(--t1-ink)" stroke="var(--surface)" strokeWidth="1.6" />
        <circle cx={sx(F, end.x)} cy={sy(F, end.y)} r="5" fill="var(--t5-ink)" stroke="var(--surface)" strokeWidth="1.6" />
      </Clip>
      <g fontSize="11">
        <text x={F.left + 8} y="26" fill="var(--t1-ink)">exact: y = 2eˣ − x − 1</text>
        <text x={F.left + 8} y="40" fill="var(--t5-ink)">Euler polygon, h = {num(h)}</text>
      </g>
    </svg>
  );
}

export default function EulerStep({ alt, props }: WidgetProps) {
  const [idx, setIdx] = useState(() => {
    const i = STEP_SIZES.indexOf(numProp(props, "h", 0.25, 0.05, 0.5));
    return i >= 0 ? i : STEP_SIZES.indexOf(0.25);
  });
  const h = STEP_SIZES[idx];
  const pts = eulerPoints(h);
  const est = pts[pts.length - 1].y;
  const exact = exactY(X_END);
  return (
    <WidgetFrame
      id="euler-step"
      title="Euler's method"
      hint="Drag the slider"
      caption="Euler's method follows the tangent for one step of width h: yₙ₊₁ = yₙ + h·f(xₙ, yₙ) and xₙ₊₁ = xₙ + h. Smaller steps stay closer to the exact curve. The step sizes offered all divide 1, so the last point lands on x = 1."
      svg={renderEulerSvg(alt, { h })}
    >
      <p>dy/dx = x + y, y(0) = 1, so the exact solution is y = 2eˣ − x − 1</p>
      <Slider label="h (step size)" value={idx} min={0} max={STEP_SIZES.length - 1} step={1} onChange={setIdx} format={(v) => num(STEP_SIZES[v])} valueText={(v) => `h = ${num(STEP_SIZES[v])}, ${eulerPoints(STEP_SIZES[v]).length - 1} steps`} />
      <p>Steps from x = 0 to x = 1: <output aria-live="off" data-testid="steps">{pts.length - 1}</output></p>
      <p>
        <output aria-live="polite" data-testid="result">Euler estimate of y(1) = {fmt(est, 4)} with h = {num(h)}, exact y(1) = 2e − 2 = {fmt(exact, 4)}, error {fmt(exact - est, 4)}</output>
      </p>
    </WidgetFrame>
  );
}
