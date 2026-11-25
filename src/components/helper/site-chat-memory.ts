// Pepper's conversations, kept in memory only (never in browser storage) and owned by one signed-in account. Each
// thread is either the site-wide chat or one question's chat. They survive closing and reopening the panel and
// client-side navigation, not a reload. A different account, or signing out, never sees them.
import type { SiteNavigationEvent } from "@/lib/helper/site-events";

export type SiteOpened = Pick<SiteNavigationEvent, "path" | "label"> & { kind?: SiteNavigationEvent["kind"] };
/** `photo` is the student's photo, shown as a thumbnail; it is never resent (later turns carry a note instead). */
export type SiteTurn = { role: "user" | "assistant"; text: string; opened?: SiteOpened[]; photo?: string };

/** The site-wide chat, or one question's chat. */
export const siteThread = "site";
export const questionThread = (bank: string, questionId: string) => `q:${bank}:${questionId}`;

/** Question chats kept per account; the oldest is dropped first. */
const MAX_THREADS = 8;
let memory: { userId: string; threads: Map<string, SiteTurn[]> } | null = null;

/** This account's conversation in a thread, or an empty one when the memory belongs to someone else (or no one). */
export function recallSiteChat(userId: string, thread: string = siteThread): SiteTurn[] {
  return memory && memory.userId === userId ? memory.threads.get(thread) ?? [] : [];
}

export function rememberSiteChat(userId: string, turns: SiteTurn[], thread: string = siteThread): void {
  if (!memory || memory.userId !== userId) memory = { userId, threads: new Map() };
  memory.threads.delete(thread);
  memory.threads.set(thread, turns);
  while (memory.threads.size > MAX_THREADS) memory.threads.delete(memory.threads.keys().next().value!);
}

export function forgetSiteChat(): void {
  memory = null;
}
