"use client";

import { browserAccountId } from "@/lib/product-analytics";
import { createClient } from "@/lib/supabase/browser";

/**
 * First-party account activity (supabase/migrations/20261127000000_account_activity_daily.sql):
 * for a signed-in account, each page it opens adds one page view and the page's area to that
 * account's row for the day, in our own database. Nothing goes to an analytics provider, so this
 * does not depend on the analytics-cookie choice (disclosed on /privacy). Signed-out visits send
 * nothing. Best effort: a failure never reaches the page.
 */
export type ActivityArea = "home" | "bank" | "past_papers" | "notes" | "helper" | "worksheets" | "dashboard" | "pricing" | "account" | "articles" | "other";

const AREA_PREFIXES: Array<[string, ActivityArea]> = [
  ["/banks", "bank"],
  ["/past-papers", "past_papers"],
  ["/revision-notes", "notes"],
  ["/helper", "helper"],
  ["/worksheets", "worksheets"],
  ["/dashboard", "dashboard"],
  ["/pricing", "pricing"],
  ["/account", "account"],
  ["/articles", "articles"],
];

export function activityArea(pathname: string): ActivityArea {
  if (pathname === "/") return "home";
  for (const [prefix, area] of AREA_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return area;
  }
  return "other";
}

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<unknown> };

export function recordAccountActivity(pathname: string, client: () => RpcClient = createClient) {
  if (typeof window === "undefined" || !browserAccountId()) return;
  const send = () => {
    try {
      void Promise.resolve(client().rpc("record_account_activity", { p_area: activityArea(pathname) })).catch(() => {});
    } catch { /* Never affect the page. */ }
  };
  // After the page has settled, so it never competes with what the student opened the page for.
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(send, { timeout: 5000 });
  else window.setTimeout(send, 1500);
}
