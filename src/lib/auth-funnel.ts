/** Bounded description of where an auth page sends the visitor next, for funnel breakdowns. Never the raw URL. */
export function authDestination(next: string): { from: string; bank?: string } {
  const path = next.split(/[?#]/)[0] ?? "";
  const bank = /^\/banks\/([a-z0-9-]{2,64})(?:\/|$)/.exec(path)?.[1];
  if (bank) return { from: "bank", bank };
  if (path.startsWith("/pricing")) return { from: "pricing" };
  if (path.startsWith("/worksheets")) return { from: "worksheets" };
  if (path.startsWith("/past-papers")) return { from: "past_papers" };
  if (path.startsWith("/account")) return { from: "account" };
  if (path.startsWith("/dashboard")) return { from: "dashboard" };
  return { from: path === "/" || path === "" ? "home" : "other" };
}
