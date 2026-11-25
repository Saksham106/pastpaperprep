// The site helper's conversation, kept in memory only (never in browser storage) and owned by one signed-in account.
// It survives closing and reopening the panel and client-side navigation, not a reload. A different account, or
// signing out, never sees it.
import type { SiteNavigationEvent } from "@/lib/helper/site-events";

export type SiteOpened = Pick<SiteNavigationEvent, "path" | "label"> & { kind?: SiteNavigationEvent["kind"] };
export type SiteTurn = { role: "user" | "assistant"; text: string; opened?: SiteOpened[] };

let memory: { userId: string; turns: SiteTurn[] } | null = null;

/** This account's conversation, or an empty one when the memory belongs to someone else (or no one). */
export function recallSiteChat(userId: string): SiteTurn[] {
  return memory && memory.userId === userId ? memory.turns : [];
}

export function rememberSiteChat(userId: string, turns: SiteTurn[]): void {
  memory = { userId, turns };
}

export function forgetSiteChat(): void {
  memory = null;
}
