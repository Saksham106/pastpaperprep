"use client";

import { useState } from "react";
import { fmt } from "./format";
import { Clip, curvePath, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { P_X, SECANT_CURVES, secantGradient, type SecantCurve } from "./secant-math";
import { numProp, type WidgetProps } from "./types";

const FRAME: Frame = { xMin: -0.5, xMax: 3, yMin: -1, yMax: 9, left: 28, top: 10, width: 322, height: 232 };

export type SecantState = { curve: SecantCurve; h: number };

export function renderSecantSvg(alt: string, { curve, h }: SecantState) {
  const { f, df } = SECANT_CURVES[curve];
  const f0 = FRAME;
  const m = secantGradient(f, h);
  const qx = P_X + h;
  const qy = f(qx);
  const py = f(P_X);
  const line = (g: number) => (x: number) => py + g * (x - P_X);
  const tangent = line(df(P_X));
  const secant = line(m);
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={f0} />
      <Clip f={f0}>
        <path d={curvePath(f0, f, f0.xMin, f0.xMax)} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
        <path d={curvePath(f0, tangent, f0.xMin, f0.xMax, 2)} fill="none" stroke="var(--t1-ink)" strokeWidth="1.8" strokeDasharray="6 4" />
        <path d={curvePath(f0, secant, f0.xMin, f0.xMax, 2)} fill="none" stroke="var(--t5-ink)" strokeWidth="2.2" />
      </Clip>
      <circle cx={sx(f0, P_X)} cy={sy(f0, py)} r="5" fill="var(--ink)" />
      <circle cx={sx(f0, qx)} cy={sy(f0, qy)} r="5" fill="var(--t5-ink)" />
      <g fontSize="12" fill="var(--ink)">
        <text x={sx(f0, P_X) + 8} y={sy(f0, py) + 16}>P</text>
        <text x={sx(f0, qx) - 10} y={sy(f0, qy) - 8}>Q</text>
      </g>
      <g fontSize="11">
        <text x={f0.left + 8} y="26" fill="var(--t5-ink)">secant PQ</text>
        <text x={f0.left + 8} y="40" fill="var(--t1-ink)">tangent at P</text>
      </g>
    </svg>
  );
}

export default function SecantToTangent({ alt, props }: WidgetProps) {
  const [curve, setCurve] = useState<SecantCurve>(props?.curve === "cube" ? "cube" : "square");
  const [h, setH] = useState(() => numProp(props, "h", 1, 0.01, 1.5));
  const { f, df } = SECANT_CURVES[curve];
  return (
    <WidgetFrame
      id="secant-to-tangent"
      title="From secant to tangent"
      caption="As Q slides towards P, h → 0 and the gradient of the chord PQ settles on the gradient of the tangent, f′(1)."
      svg={renderSecantSvg(alt, { curve, h })}
    >
      <p>
        <label>Curve{" "}
          <select value={curve} onChange={(e) => setCurve(e.target.value as SecantCurve)}>
            {(Object.keys(SECANT_CURVES) as SecantCurve[]).map((k) => <option key={k} value={k}>{SECANT_CURVES[k].label}</option>)}
          </select>
        </label>
      </p>
      <Slider label="h (Q is at x = 1 + h)" value={h} min={0.01} max={1.5} step={0.01} onChange={setH} format={(v) => fmt(v)} />
      <p>P = (1, {fmt(f(1))}), Q = ({fmt(1 + h)}, {fmt(f(1 + h), 3)})</p>
      <p>Secant gradient = <output data-testid="secant" aria-live="polite">{fmt(secantGradient(f, h), 3)}</output></p>
      <p>Tangent gradient f′(1) = <output data-testid="tangent">{fmt(df(1), 0)}</output></p>
    </WidgetFrame>
  );
}
