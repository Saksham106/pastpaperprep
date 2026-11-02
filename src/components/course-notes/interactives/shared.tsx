import { useId, type ReactNode } from "react";
import styles from "../course-notes.module.css";
import { fmt } from "./format";

export type Frame = { xMin: number; xMax: number; yMin: number; yMax: number; left: number; top: number; width: number; height: number };

export const sx = (f: Frame, x: number) => f.left + ((x - f.xMin) / (f.xMax - f.xMin)) * f.width;
export const sy = (f: Frame, y: number) => f.top + ((f.yMax - y) / (f.yMax - f.yMin)) * f.height;

/** SVG path for y = fn(x) over [x0, x1]; breaks the line where fn is not finite or far outside the frame. */
export function curvePath(f: Frame, fn: (x: number) => number, x0: number, x1: number, n = 240): string {
  const limit = (f.yMax - f.yMin) * 6;
  let d = "";
  let pen = false;
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n;
    const y = fn(x);
    if (!Number.isFinite(y) || Math.abs(y) > limit) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${sx(f, x).toFixed(1)} ${sy(f, y).toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Clips its children to the plot area (a nested svg clips without needing an id). */
export function Clip({ f, children }: { f: Frame; children: ReactNode }) {
  return (
    <svg x={f.left} y={f.top} width={f.width} height={f.height} viewBox={`${f.left} ${f.top} ${f.width} ${f.height}`}>
      {children}
    </svg>
  );
}

/** Unit grid, axes and integer tick labels for a Frame. */
export function Grid({ f, labelEvery = 1 }: { f: Frame; labelEvery?: number }) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let x = Math.ceil(f.xMin); x <= f.xMax; x++) xs.push(x);
  for (let y = Math.ceil(f.yMin); y <= f.yMax; y++) ys.push(y);
  const x0 = sx(f, 0);
  const y0 = sy(f, 0);
  return (
    <g fontSize="10" fill="var(--muted)">
      {xs.map((x) => (
        <line key={`gx${x}`} x1={sx(f, x)} y1={f.top} x2={sx(f, x)} y2={f.top + f.height} stroke="var(--line)" strokeWidth="1" />
      ))}
      {ys.map((y) => (
        <line key={`gy${y}`} x1={f.left} y1={sy(f, y)} x2={f.left + f.width} y2={sy(f, y)} stroke="var(--line)" strokeWidth="1" />
      ))}
      <line x1={f.left} y1={y0} x2={f.left + f.width} y2={y0} stroke="var(--muted)" strokeWidth="1.2" />
      <line x1={x0} y1={f.top} x2={x0} y2={f.top + f.height} stroke="var(--muted)" strokeWidth="1.2" />
      {xs.filter((x) => x !== 0 && x % labelEvery === 0).map((x) => (
        <text key={`tx${x}`} x={sx(f, x)} y={y0 + 12} textAnchor="middle">{fmt(x, 0)}</text>
      ))}
      {ys.filter((y) => y !== 0 && y % labelEvery === 0).map((y) => (
        <text key={`ty${y}`} x={x0 - 4} y={sy(f, y) + 3} textAnchor="end">{fmt(y, 0)}</text>
      ))}
    </g>
  );
}

export function Slider({ label, value, min, max, step, onChange, format, live = false }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  /** Announce changes politely. Leave off unless this is the one key readout of the widget. */
  live?: boolean;
}) {
  const id = useId();
  return (
    <div className={styles.slider}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id} aria-live={live ? "polite" : "off"}>{format(value)}</output>
    </div>
  );
}

export function WidgetFrame({ id, title, hint = "Drag the slider", caption, svg, children }: {
  id: string;
  title: string;
  hint?: string;
  caption: string;
  svg: ReactNode;
  children: ReactNode;
}) {
  return (
    <figure className={styles.widget} data-widget={id}>
      <div className={styles.iHead}>
        <b>{title}</b>
        <span>{hint}</span>
      </div>
      <div className={styles.iBody}>
        {svg}
        <div className={styles.iRead}>{children}</div>
      </div>
      <figcaption className={styles.iCaption}>{caption}</figcaption>
    </figure>
  );
}

/**
 * Convert a pointer event to the user units of the widget's outer svg[role=img].
 * Uses the svg's screen CTM, so nested svgs (clip frames), scaling and viewBox offsets are all accounted for.
 */
export function pointerToSvg(e: { clientX: number; clientY: number }, from: Element): { x: number; y: number } {
  const svg = (from.closest("svg[role=img]") ?? from) as SVGSVGElement;
  const ctm = svg.getScreenCTM?.();
  if (ctm) {
    const m = ctm.inverse();
    return { x: m.a * e.clientX + m.c * e.clientY + m.e, y: m.b * e.clientX + m.d * e.clientY + m.f };
  }
  // Fallback: assume the viewBox fills the box (xMidYMid scaling is not modelled).
  const r = svg.getBoundingClientRect();
  const [vx, vy, vw, vh] = (svg.getAttribute("viewBox") ?? `0 0 ${r.width} ${r.height}`).split(/[\s,]+/).map(Number);
  return { x: vx + ((e.clientX - r.left) / r.width) * vw, y: vy + ((e.clientY - r.top) / r.height) * vh };
}
