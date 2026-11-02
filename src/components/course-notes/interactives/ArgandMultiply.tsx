"use client";

import { useState, type SVGProps } from "react";
import { fmt, fmtComplex, num } from "./format";
import { Clip, Grid, pointerToSvg, Slider, sx, sy, WidgetFrame, type Frame } from "./shared";
import { DEG, multiplyPolar } from "./complex-math";
import { numProp, type WidgetProps } from "./types";

const F: Frame = { xMin: -6.5, xMax: 6.5, yMin: -6.5, yMax: 6.5, left: 60, top: 10, width: 240, height: 240 };
const R_LIM = { lo: 0.5, hi: 2.5 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Moduli are in units, arguments in degrees (−180 to 180). */
export type ArgandState = { r1: number; d1: number; r2: number; d2: number };

/** Polyline for an arc of radius r from angle a0 to a1 (radians, either direction). */
function arcPath(r: number, a0: number, a1: number): string {
  const steps = 24;
  let d = "";
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    d += `${k === 0 ? "M" : "L"}${sx(F, r * Math.cos(a)).toFixed(1)} ${sy(F, r * Math.sin(a)).toFixed(1)}`;
  }
  return d;
}

export function renderArgandSvg(alt: string, { r1, d1, r2, d2 }: ArgandState, dragProps?: SVGProps<SVGCircleElement>) {
  const m = multiplyPolar(r1, d1 * DEG, r2, d2 * DEG);
  const pts = [
    { name: "z", p: m.z, color: "var(--t1-ink)", arc: [0.5, d1 * DEG] as const },
    { name: "w", p: m.w, color: "var(--t5-ink)", arc: [0.9, d2 * DEG] as const },
    { name: "zw", p: m.zw, color: "var(--ink)", arc: [1.3, m.arg] as const },
  ];
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label={alt}>
      <Grid f={F} labelEvery={2} />
      <text x={F.left + F.width - 4} y={sy(F, 0) - 4} fontSize="10" textAnchor="end" fill="var(--muted)">Re</text>
      <text x={sx(F, 0) + 5} y={F.top + 10} fontSize="10" fill="var(--muted)">Im</text>
      <Clip f={F}>
        {pts.map((q) => (
          <g key={q.name}>
            <path d={arcPath(q.arc[0], 0, q.arc[1])} fill="none" stroke={q.color} strokeWidth="1.4" />
            <line x1={sx(F, 0)} y1={sy(F, 0)} x2={sx(F, q.p.re)} y2={sy(F, q.p.im)} stroke={q.color} strokeWidth={q.name === "zw" ? 2.8 : 2} strokeDasharray={q.name === "zw" ? undefined : "5 3"} />
          </g>
        ))}
        {pts.map((q) => (
          <circle key={q.name} cx={sx(F, q.p.re)} cy={sy(F, q.p.im)} r={q.name === "z" ? 7 : 5} fill={q.color} stroke="var(--surface)" strokeWidth="2" style={q.name === "z" ? { cursor: "grab", touchAction: "none" } : undefined} {...(q.name === "z" ? dragProps : {})} />
        ))}
      </Clip>
      <g fontSize="12" fontWeight="600">
        {pts.map((q) => (
          <text key={q.name} x={sx(F, q.p.re) + 9} y={sy(F, q.p.im) - 8} fill={q.color}>{q.name}</text>
        ))}
      </g>
      <g fontSize="11">
        <text x="8" y="26" fill="var(--t1-ink)">z (drag me)</text>
        <text x="8" y="40" fill="var(--t5-ink)">w</text>
        <text x="8" y="54" fill="var(--ink)">zw (solid)</text>
      </g>
    </svg>
  );
}

export default function ArgandMultiply({ alt, props }: WidgetProps) {
  const [s, setS] = useState<ArgandState>(() => ({
    r1: numProp(props, "r1", 1.5, R_LIM.lo, R_LIM.hi),
    d1: numProp(props, "d1", 60, -180, 180),
    r2: numProp(props, "r2", 2, R_LIM.lo, R_LIM.hi),
    d2: numProp(props, "d2", 30, -180, 180),
  }));
  const set = (k: keyof ArgandState) => (v: number) => setS((q) => ({ ...q, [k]: v }));
  const m = multiplyPolar(s.r1, s.d1 * DEG, s.r2, s.d2 * DEG);
  const argDeg = m.arg / DEG;

  const dragProps: SVGProps<SVGCircleElement> = {
    onPointerDown: (e) => e.currentTarget.setPointerCapture(e.pointerId),
    onPointerMove: (e) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const { x: px, y: py } = pointerToSvg(e, e.currentTarget);
      const re = F.xMin + ((px - F.left) / F.width) * (F.xMax - F.xMin);
      const im = F.yMax - ((py - F.top) / F.height) * (F.yMax - F.yMin);
      const r1 = clamp(Math.round(Math.hypot(re, im) * 10) / 10, R_LIM.lo, R_LIM.hi);
      const d1 = Math.round((Math.atan2(im, re) / DEG) / 5) * 5;
      setS((q) => ({ ...q, r1, d1 }));
    },
  };

  const polar = (r: number, d: number) => `${fmt(r, 2)} cis ${num(d)}°`;
  return (
    <WidgetFrame
      id="argand-multiply"
      title="Multiplying complex numbers"
      hint="Drag z or use the sliders"
      caption="Multiplying multiplies the moduli and adds the arguments: |zw| = |z||w| and arg(zw) = arg z + arg w, reduced to (−π, π]. So multiplying by w scales by |w| and rotates by arg w."
      svg={renderArgandSvg(alt, s, dragProps)}
    >
      <Slider label="|z| (modulus of z)" value={s.r1} min={R_LIM.lo} max={R_LIM.hi} step={0.1} onChange={set("r1")} format={(v) => fmt(v, 1)} />
      <Slider label="arg z (degrees)" value={s.d1} min={-180} max={180} step={5} onChange={set("d1")} format={(v) => `${num(v)}°`} />
      <Slider label="|w| (modulus of w)" value={s.r2} min={R_LIM.lo} max={R_LIM.hi} step={0.1} onChange={set("r2")} format={(v) => fmt(v, 1)} />
      <Slider label="arg w (degrees)" value={s.d2} min={-180} max={180} step={5} onChange={set("d2")} format={(v) => `${num(v)}°`} />
      <p>z = {polar(s.r1, s.d1)} = <output aria-live="off" data-testid="z">{fmtComplex(m.z.re, m.z.im)}</output></p>
      <p>w = {polar(s.r2, s.d2)} = <output aria-live="off" data-testid="w">{fmtComplex(m.w.re, m.w.im)}</output></p>
      <p>|zw| = |z||w| = {fmt(s.r1, 1)} × {fmt(s.r2, 1)} = <output aria-live="off" data-testid="modulus">{fmt(m.modulus, 2)}</output></p>
      <p>arg(zw) = {num(s.d1)}° + {num(s.d2)}° = <output aria-live="off" data-testid="arg">{num(argDeg)}°</output> (reduced to (−180°, 180°])</p>
      <p>
        zw = <output aria-live="polite" data-testid="result">{polar(m.modulus, argDeg)} = {fmtComplex(m.zw.re, m.zw.im)}</output>
      </p>
    </WidgetFrame>
  );
}
