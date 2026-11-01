"use client";

import { fmt, Slider, WidgetFrame } from "./shared";
import { useState } from "react";
import { toDegrees, unitCirclePoint } from "./unit-circle-math";
import { numProp, type WidgetProps } from "./types";

const TAU = 2 * Math.PI;
// Unit circle on the left, graphs on the right.
const CX = 70;
const CY = 120;
const R = 52;
const GX = 160; // graph x = 0
const GW = 190; // width for 0..2π
const GR = 52; // graph y scale per unit
const gx = (x: number) => GX + (x / TAU) * GW;
const gy = (y: number) => CY - y * GR;

function wave(fn: (x: number) => number) {
  let d = "";
  for (let k = 0; k <= 120; k++) {
    const x = (TAU * k) / 120;
    d += `${k ? "L" : "M"}${gx(x).toFixed(1)} ${gy(fn(x)).toFixed(1)}`;
  }
  return d;
}

export type UnitCircleState = { theta: number };

export function renderUnitCircleSvg(alt: string, { theta }: UnitCircleState) {
  const { cos, sin } = unitCirclePoint(theta);
  const px = CX + R * cos;
  const py = CY - R * sin;
  const ticks: [number, string][] = [[Math.PI / 2, "π/2"], [Math.PI, "π"], [(3 * Math.PI) / 2, "3π/2"], [TAU, "2π"]];
  return (
    <svg viewBox="0 0 370 240" role="img" aria-label={alt}>
      {/* unit circle */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      <line x1={CX - R - 8} y1={CY} x2={CX + R + 8} y2={CY} stroke="var(--muted)" />
      <line x1={CX} y1={CY - R - 8} x2={CX} y2={CY + R + 8} stroke="var(--muted)" />
      <line x1={CX} y1={CY} x2={px} y2={py} stroke="var(--ink)" strokeWidth="2" />
      <line x1={px} y1={py} x2={px} y2={CY} stroke="var(--t5-ink)" strokeWidth="2" />
      <line x1={CX} y1={CY} x2={px} y2={CY} stroke="var(--t1-ink)" strokeWidth="2" />
      <circle cx={px} cy={py} r="5" fill="var(--ink)" />
      <text x={CX + R + 8} y={CY + 14} fontSize="10" fill="var(--muted)" textAnchor="end">cos</text>
      <text x={CX + 6} y={CY - R - 10} fontSize="10" fill="var(--muted)">sin</text>
      {/* graphs */}
      <line x1={GX} y1={CY} x2={GX + GW + 8} y2={CY} stroke="var(--muted)" />
      <line x1={GX} y1={CY - GR - 10} x2={GX} y2={CY + GR + 10} stroke="var(--muted)" />
      <g fontSize="10" fill="var(--muted)" textAnchor="middle">
        {ticks.map(([x, label]) => (
          <g key={label}>
            <line x1={gx(x)} y1={CY - 3} x2={gx(x)} y2={CY + 3} stroke="var(--muted)" />
            <text x={gx(x)} y={CY + 16}>{label}</text>
          </g>
        ))}
        <text x={GX - 6} y={gy(1) + 3} textAnchor="end">1</text>
        <text x={GX - 6} y={gy(-1) + 3} textAnchor="end">−1</text>
      </g>
      <path d={wave(Math.sin)} fill="none" stroke="var(--t5-ink)" strokeWidth="2.2" />
      <path d={wave(Math.cos)} fill="none" stroke="var(--t1-ink)" strokeWidth="2.2" />
      <line x1={gx(theta)} y1={gy(-1)} x2={gx(theta)} y2={gy(1)} stroke="var(--ink-soft)" strokeDasharray="4 4" />
      <line x1={px} y1={py} x2={gx(theta)} y2={gy(sin)} stroke="var(--t5-ink)" strokeDasharray="2 3" strokeWidth="1" />
      <circle cx={gx(theta)} cy={gy(sin)} r="4.5" fill="var(--t5-ink)" />
      <circle cx={gx(theta)} cy={gy(cos)} r="4.5" fill="var(--t1-ink)" />
      <g fontSize="11">
        <text x={GX + GW + 8} y="24" textAnchor="end" fill="var(--t5-ink)">y = sin x</text>
        <text x={GX + GW + 8} y="38" textAnchor="end" fill="var(--t1-ink)">y = cos x</text>
      </g>
    </svg>
  );
}

export default function UnitCircleGraphs({ alt, props }: WidgetProps) {
  const [theta, setTheta] = useState(() => numProp(props, "theta", Math.PI / 6, 0, 6.28));
  const { cos, sin } = unitCirclePoint(theta);
  return (
    <WidgetFrame
      id="unit-circle-graphs"
      title="From the circle to the graphs"
      caption="The height of the point on the circle is sin θ and its distance along is cos θ. Each is the matching graph's value at x = θ."
      svg={renderUnitCircleSvg(alt, { theta })}
    >
      <Slider label="θ (radians)" value={theta} min={0} max={6.28} step={0.01} onChange={setTheta} format={(v) => `${fmt(v)} rad`} />
      <p>θ = {fmt(toDegrees(theta), 0)}°</p>
      <p>cos θ = <output aria-live="polite" data-testid="cos">{fmt(cos, 3)}</output></p>
      <p>sin θ = <output aria-live="polite" data-testid="sin">{fmt(sin, 3)}</output></p>
    </WidgetFrame>
  );
}
