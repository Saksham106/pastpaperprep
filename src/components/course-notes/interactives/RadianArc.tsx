"use client";

import { useState } from "react";
import { fmt } from "./format";
import { Slider, WidgetFrame } from "./shared";
import { arcLength, radToDeg, sectorArea } from "./radian-arc-math";
import { numProp, type WidgetProps } from "./types";

const TAU = 2 * Math.PI;
const CX = 150;
const CY = 130;
const PX = 36; // pixels per unit of radius (max r = 3 gives 108, leaving room for the s label)

export type RadianArcState = { r: number; theta: number };

export function renderRadianArcSvg(alt: string, { r, theta }: RadianArcState) {
  const R = r * PX;
  const ex = CX + R * Math.cos(theta);
  const ey = CY - R * Math.sin(theta);
  const full = theta >= TAU - 1e-6;
  const large = theta > Math.PI ? 1 : 0;
  const sector = full
    ? ""
    : `M${CX} ${CY} L${CX + R} ${CY} A${R} ${R} 0 ${large} 0 ${ex.toFixed(1)} ${ey.toFixed(1)} Z`;
  const arc = full ? "" : `M${CX + R} ${CY} A${R} ${R} 0 ${large} 0 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  const mid = theta / 2;
  const lx = CX + (R + 14) * Math.cos(mid);
  const ly = CY - (R + 14) * Math.sin(mid) + 4;
  const ar = Math.min(18, R * 0.4);
  const ax = CX + ar * Math.cos(theta);
  const ay = CY - ar * Math.sin(theta);
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--line-strong)" strokeWidth="1.2" strokeDasharray="3 4" />
      {full ? <circle cx={CX} cy={CY} r={R} fill="var(--t1)" /> : <path d={sector} fill="var(--t1)" />}
      <line x1={CX - 128} y1={CY} x2={CX + 128} y2={CY} stroke="var(--muted)" />
      <line x1={CX} y1={CY - 125} x2={CX} y2={CY + 125} stroke="var(--muted)" />
      <line x1={CX} y1={CY} x2={CX + R} y2={CY} stroke="var(--ink)" strokeWidth="2" />
      <line x1={CX} y1={CY} x2={ex} y2={ey} stroke="var(--ink)" strokeWidth="2" />
      {full ? (
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--t5-ink)" strokeWidth="3.5" />
      ) : (
        <path d={arc} fill="none" stroke="var(--t5-ink)" strokeWidth="3.5" />
      )}
      {theta > 0.05 && !full && (
        <path d={`M${CX + ar} ${CY} A${ar} ${ar} 0 ${large} 0 ${ax.toFixed(1)} ${ay.toFixed(1)}`} fill="none" stroke="var(--ink-soft)" strokeWidth="1.2" />
      )}
      <g fontSize="12" fill="var(--ink)">
        {theta > 0.3 && <text x={CX + 22} y={CY - 6}>θ</text>}
        {theta > 0.3 && <text x={lx} y={ly} textAnchor="middle" fill="var(--t5-ink)" fontStyle="italic">s</text>}
        <text x={CX + R / 2} y={CY + 16} textAnchor="middle" fontStyle="italic">r</text>
      </g>
    </svg>
  );
}

export default function RadianArc({ alt, props }: WidgetProps) {
  const [theta, setTheta] = useState(() => numProp(props, "theta", Math.PI / 3, 0, TAU));
  const [r, setR] = useState(() => numProp(props, "r", 2, 0.5, 3));
  return (
    <WidgetFrame
      id="radian-arc"
      title="Arc length and sector area"
      caption="One radian is the angle whose arc is as long as the radius, so the arc length is s = rθ and the sector is the fraction θ/2π of the circle, A = ½r²θ."
      svg={renderRadianArcSvg(alt, { r, theta })}
    >
      <Slider label="θ (radians)" value={theta} min={0} max={TAU} step={0.01} onChange={(v) => setTheta(v >= 6.28 ? TAU : v)} format={(v) => `${fmt(v)} rad`} />
      <Slider label="r (radius)" value={r} min={0.5} max={3} step={0.1} onChange={setR} format={(v) => fmt(v, 1)} />
      <p>θ = <output data-testid="degrees">{fmt(radToDeg(theta), 1)}</output>°</p>
      <p>Arc length s = rθ = <output data-testid="arc" aria-live="polite">{fmt(arcLength(r, theta), 3)}</output></p>
      <p>Sector area A = ½r²θ = <output data-testid="sector">{fmt(sectorArea(r, theta), 3)}</output></p>
    </WidgetFrame>
  );
}
