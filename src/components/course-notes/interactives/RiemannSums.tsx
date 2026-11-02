"use client";

import { useState } from "react";
import { fmt } from "./format";
import { Clip, curvePath, Grid, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { A, B, EXACT, F, riemannSum, sampleX, type RiemannMode } from "./riemann-math";
import { numProp, type WidgetProps } from "./types";

const FRAME: Frame = { xMin: -0.3, xMax: 2.4, yMin: -0.5, yMax: 4.5, left: 28, top: 10, width: 322, height: 232 };
const MODES: [RiemannMode, string][] = [["left", "Left endpoints"], ["right", "Right endpoints"], ["mid", "Midpoints"]];

export type RiemannState = { n: number; mode: RiemannMode };

export function renderRiemannSvg(alt: string, { n, mode }: RiemannState) {
  const fr = FRAME;
  const w = (B - A) / n;
  const rects = [];
  for (let i = 0; i < n; i++) {
    const x0 = A + i * w;
    const h = F(sampleX(i, n, mode));
    rects.push(
      <rect key={i} x={sx(fr, x0)} y={sy(fr, h)} width={sx(fr, x0 + w) - sx(fr, x0)} height={sy(fr, 0) - sy(fr, h)} fill="var(--t1)" stroke="var(--t1-ink)" strokeWidth={n > 25 ? 0.4 : 1} />,
    );
  }
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={fr} />
      <Clip f={fr}>
        {rects}
        <path d={curvePath(fr, F, fr.xMin, fr.xMax)} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
      </Clip>
    </svg>
  );
}

export default function RiemannSums({ alt, props }: WidgetProps) {
  const [n, setN] = useState(() => Math.round(numProp(props, "n", 4, 1, 50)));
  const [mode, setMode] = useState<RiemannMode>(props?.mode === "left" || props?.mode === "right" ? props.mode : "mid");
  const sum = riemannSum(n, mode);
  return (
    <WidgetFrame
      id="riemann-sums"
      title="Rectangles to an integral"
      caption="More, thinner rectangles squeeze the sum towards the exact area ∫₀² x² dx = 8/3. Left sums fall short and right sums overshoot because x² is increasing."
      svg={renderRiemannSvg(alt, { n, mode })}
    >
      <p>
        <label>Rectangle heights{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value as RiemannMode)}>
            {MODES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
      </p>
      <Slider label="n (rectangles)" value={n} min={1} max={50} step={1} onChange={setN} format={(v) => String(v)} />
      <p>Sum = <output data-testid="sum" aria-live="polite">{fmt(sum, 3)}</output></p>
      <p>Exact ∫₀² x² dx = 8/3 ≈ <output aria-live="off" data-testid="exact">{fmt(EXACT, 3)}</output></p>
      <p>Error = <output aria-live="off" data-testid="error">{fmt(sum - EXACT, 3)}</output></p>
    </WidgetFrame>
  );
}
