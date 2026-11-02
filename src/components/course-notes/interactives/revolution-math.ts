/** Solid of revolution about the x-axis for y = f(x) on [0, b]. React-free. */
export type RevShape = "sqrt" | "line";

export const REV_SHAPES: Record<RevShape, { label: string; f: (x: number) => number; formula: string; volume: (b: number) => number }> = {
  // V = π∫₀ᵇ (√x)² dx = π∫₀ᵇ x dx = π b²/2
  sqrt: { label: "y = √x", f: Math.sqrt, formula: "V = π∫₀ᵇ x dx = πb²/2", volume: (b) => (Math.PI * b * b) / 2 },
  // V = π∫₀ᵇ x² dx = π b³/3
  line: { label: "y = x", f: (x) => x, formula: "V = π∫₀ᵇ x² dx = πb³/3", volume: (b) => (Math.PI * b ** 3) / 3 },
};

export const discRadius = (shape: RevShape, x: number) => REV_SHAPES[shape].f(x);
export const discArea = (shape: RevShape, x: number) => Math.PI * discRadius(shape, x) ** 2;
