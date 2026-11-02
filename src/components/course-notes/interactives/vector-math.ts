export type Vec = { x: number; y: number };

export const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
export const norm = (a: Vec) => Math.hypot(a.x, a.y);

/** cos θ = a·b / (|a||b|), clamped against rounding; null when either vector is zero. */
export function cosAngle(a: Vec, b: Vec): number | null {
  const d = norm(a) * norm(b);
  return d === 0 ? null : Math.min(1, Math.max(-1, dot(a, b) / d));
}

/** Angle between the vectors in degrees, 0 to 180; null when either vector is zero. */
export function angleDegrees(a: Vec, b: Vec): number | null {
  const c = cosAngle(a, b);
  return c === null ? null : (Math.acos(c) * 180) / Math.PI;
}

export const isPerpendicular = (a: Vec, b: Vec) => Math.abs(dot(a, b)) < 1e-9;
