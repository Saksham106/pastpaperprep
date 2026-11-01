/** Fixed-decimal display with a real minus sign and no negative zero. */
export function fmt(n: number, dp = 2): string {
  const s = n.toFixed(dp);
  return (Number(s) === 0 ? (0).toFixed(dp) : s).replace("-", "−");
}

/** Shortest display of a slider-sized number (at most 2 decimals), with a real minus sign. */
export function num(n: number): string {
  return String(Number(n.toFixed(2))).replace("-", "−");
}
