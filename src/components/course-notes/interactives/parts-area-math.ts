/** Integration by parts as areas, for v = u² from u = 0 to u = b. */
export function partsAreas(b: number) {
  return {
    /** Area under the curve: the integral of v du = b³/3. */
    underCurve: b ** 3 / 3,
    /** Area left of the curve: the integral of u dv = 2b³/3. */
    leftOfCurve: (2 * b ** 3) / 3,
    /** The rectangle b × b² = b³. */
    rectangle: b ** 3,
  };
}
