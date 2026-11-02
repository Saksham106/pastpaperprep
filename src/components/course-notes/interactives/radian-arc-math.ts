/** Arc length of a sector of radius r and angle theta (radians): s = r·θ. */
export const arcLength = (r: number, theta: number) => r * theta;

/** Sector area: A = ½·r²·θ. */
export const sectorArea = (r: number, theta: number) => 0.5 * r * r * theta;

/** Radians to degrees. */
export const radToDeg = (theta: number) => (theta * 180) / Math.PI;
