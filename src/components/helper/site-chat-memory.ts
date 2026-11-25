// Pepper's conversations for this browser tab: in memory, and in the tab's session storage under the signed-in
// account's id, so a reload or moving between pages keeps them; closing the tab or window ends them (safer on shared
// school computers). Each thread is the site chat or one question's chat. Another account never sees them: signing
// out or switching account deletes them, and so does Clear chat. Photos are never stored (a turn only remembers that
// one was sent), which keeps well under storage limits.
import type { SiteNavigationEvent } from "@/lib/helper/site-events";

export type SiteOpened = Pick<SiteNavigationEvent, "path" | "label"> & { kind?: SiteNavigationEvent["kind"] };
/** `photo` is the student's photo (a data URL) in this tab, or PHOTO_SENT once reloaded from storage. */
export type SiteTurn = { role: "user" | "assistant"; text: string; opened?: SiteOpened[]; photo?: string };

/** A photo that was sent but isn't kept: shown as a label, and resent as the photo note. */
export const PHOTO_SENT = "sent";

/** The site-wide chat, or one question's chat. */
export const siteThread = "site";
export const questionThread = (bank: string, questionId: string) => `q:${bank}:${questionId}`;

const PREFIX = "ppp:pepper:v1:";
/** Chats kept per account (the oldest goes first), and turns kept per chat. */
const MAX_THREADS = 8;
const MAX_TURNS = 40;

type Threads = Map<string, SiteTurn[]>;
let memory: { userId: string; threads: Threads } | null = null;

const storageKey = (userId: string) => `${PREFIX}${userId}`;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const isTurn = (value: unknown): value is SiteTurn => {
  const turn = value as SiteTurn | null;
  return Boolean(turn) && (turn!.role === "user" || turn!.role === "assistant") && typeof turn!.text === "string";
};

function load(userId: string): Threads {
  const threads: Threads = new Map();
  try {
    const raw = storage()?.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) as { threads?: Array<[string, unknown[]]> } : null;
    for (const [thread, turns] of parsed?.threads ?? []) {
      if (typeof thread === "string" && Array.isArray(turns)) threads.set(thread, turns.filter(isTurn));
    }
  } catch {
    // Unreadable or old data: start fresh.
  }
  return threads;
}

let pendingSave: ReturnType<typeof setTimeout> | null = null;

/** Writes at most a few times a second: a streaming reply updates the chat on every word. */
function save(userId: string, threads: Threads): void {
  if (pendingSave) clearTimeout(pendingSave);
  pendingSave = setTimeout(() => { pendingSave = null; write(userId, threads); }, 250);
}

function write(userId: string, threads: Threads): void {
  const store = storage();
  if (!store) return;
  // Text only: photos stay in this tab.
  const plain = [...threads].map(([thread, turns]) => [thread, turns.slice(-MAX_TURNS).map((turn) => (turn.photo ? { ...turn, photo: PHOTO_SENT } : turn))]);
  try {
    if (plain.length) store.setItem(storageKey(userId), JSON.stringify({ threads: plain }));
    else store.removeItem(storageKey(userId));
  } catch {
    // Full or blocked storage: the chat still works in this tab.
  }
}

/** Deletes every stored chat on this device except the given account's (all of them when it is null). */
function removeOthers(userId: string | null): void {
  const store = storage();
  if (!store) return;
  try {
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index)).filter((key): key is string => Boolean(key?.startsWith(PREFIX)));
    for (const key of keys) if (key !== (userId ? storageKey(userId) : "")) store.removeItem(key);
  } catch {
    // Nothing to clean.
  }
}

function threadsFor(userId: string): Threads {
  if (!memory || memory.userId !== userId) {
    // A different account on this device: its chats never sit beside another account's.
    removeOthers(userId);
    memory = { userId, threads: load(userId) };
  }
  return memory.threads;
}

/** This account's conversation in a thread (empty when there is none). */
export function recallSiteChat(userId: string, thread: string = siteThread): SiteTurn[] {
  return threadsFor(userId).get(thread) ?? [];
}

export function rememberSiteChat(userId: string, turns: SiteTurn[], thread: string = siteThread): void {
  const threads = threadsFor(userId);
  threads.delete(thread);
  if (turns.length) threads.set(thread, turns);
  while (threads.size > MAX_THREADS) threads.delete(threads.keys().next().value!);
  // Clearing a chat is written at once, so a reload straight after never brings it back.
  if (turns.length) save(userId, threads); else { if (pendingSave) clearTimeout(pendingSave); pendingSave = null; write(userId, threads); }
}

/** Signed out: forget every chat in memory and on this device. */
export function forgetSiteChat(): void {
  if (pendingSave) clearTimeout(pendingSave);
  pendingSave = null;
  memory = null;
  removeOthers(null);
}
