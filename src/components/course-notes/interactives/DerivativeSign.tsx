"use client";

import { useState } from "react";
import { fmt } from "./format";
import { Clip, curvePath, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { df, f, STATIONARY, trendAt } from "./derivative-sign-math";
import { numProp, type WidgetProps } from "./types";

const FRAME: Frame = { xMin: -2.5, xMax: 2.5, yMin: -4, yMax: 4, left: 28, top: 10, width: 322, height: 232 };

export type DerivativeSignState = { x: number };

export function renderDerivativeSignSvg(alt: string, { x }: DerivativeSignState) {
  const F = FRAME;
  const y = f(x);
  const g = df(x);
  const tangent = (t: number) => y + g * (t - x);
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={F} />
      <Clip f={F}>
        <path d={curvePath(F, f, F.xMin, -1)} fill="none" stroke="var(--t1-ink)" strokeWidth="3" />
        <path d={curvePath(F, f, -1, 1)} fill="none" stroke="var(--t5-ink)" strokeWidth="3" />
        <path d={curvePath(F, f, 1, F.xMax)} fill="none" stroke="var(--t1-ink)" strokeWidth="3" />
        <path d={curvePath(F, tangent, F.xMin, F.xMax, 2)} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeDasharray="6 4" />
      </Clip>
      {STATIONARY.map((p) => (
        <circle key={p.x} cx={sx(F, p.x)} cy={sy(F, p.y)} r="4.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
      ))}
      <circle cx={sx(F, x)} cy={sy(F, y)} r="5.5" fill="var(--ink)" />
      <g fontSize="11">
        <text x={F.left + 8} y="26" fill="var(--t1-ink)">increasing</text>
        <text x={F.left + 8} y="40" fill="var(--t5-ink)">decreasing</text>
        <text x={F.left + 8} y="54" fill="var(--ink)">○ stationary: x = ±1</text>
      </g>
    </svg>
  );
}

export default function DerivativeSign({ alt, props }: WidgetProps) {
  const [x, setX] = useState(() => numProp(props, "x", 0, -2.2, 2.2));
  const d = df(x);
  const trend = trendAt(x);
  return (
    <WidgetFrame
      id="derivative-sign"
      title="The sign of the derivative"
      caption="Where f′(x) > 0 the tangent slopes up and f is increasing; where f′(x) < 0 it is decreasing. The sign changes at the stationary points, where f′(x) = 0."
      svg={renderDerivativeSignSvg(alt, { x })}
    >
      <p>f(x) = x³ − 3x, so f′(x) = 3x² − 3</p>
      <Slider label="x" value={x} min={-2.2} max={2.2} step={0.1} onChange={setX} format={(v) => fmt(v, 1)} />
      <p>f′({fmt(x, 1)}) = <output data-testid="derivative" aria-live="polite">{fmt(d, 2)} ({trend})</output></p>
    </WidgetFrame>
  );
}
