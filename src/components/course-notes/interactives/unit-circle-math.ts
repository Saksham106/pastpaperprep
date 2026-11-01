export const unitCirclePoint = (theta: number) => ({ cos: Math.cos(theta), sin: Math.sin(theta) });
export const toDegrees = (theta: number) => (theta * 180) / Math.PI;
