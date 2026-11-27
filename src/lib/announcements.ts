import { bankEntryHref, freeQuestionYears, hasFreeTier } from "@/lib/access";
import type { Bank, BankSlug } from "@/lib/banks";
import { bankForSubjectSlug } from "@/lib/past-paper-catalog";
import { qualificationIdOfSlug, type QualificationId } from "@/lib/qualifications";
import { upgradeHref, yearRangeLabel } from "@/lib/upgrade-copy";
import { ANNOUNCEMENT_MAX_AGE_DAYS, type Announcement } from "@/lib/announcement-pick";
import { UPDATES, updateId, type Update } from "@/lib/updates";

export * from "@/lib/announcement-pick";

/**
 * Targeted "for you" cards on the dashboard, picked from the public changelog (UPDATES) and the
 * reader's plan. The server works out which updates apply; the browser drops dismissed ones and
 * prefers the reader's board, then shows one.
 */
export const NEW_BANK_DOT_DAYS = 21;
const DAY = 86_400_000;

const shippedAt = (date: string) => new Date(`${date}T00:00:00Z`).getTime();
const withinDays = (date: string, days: number, now: Date) => { const at = shippedAt(date); return at <= now.getTime() && at >= now.getTime() - days * DAY; };

const hrefsOf = (update: Update) => (update.links ?? []).flatMap((link) => "href" in link ? [link] : link.options.map((option) => ({ label: link.label, href: option.href })));

/** Banks an update is about: its /banks/<slug> links (not exam-style collections) and its /past-papers/<subject> links. */
export function banksOfUpdate(update: Update, live: ReadonlySet<string>): { slug: BankSlug; href: string }[] {
  const found: { slug: BankSlug; href: string }[] = [];
  for (const { href } of hrefsOf(update)) {
    const [, root, segment] = href.split(/[/?#]/);
    if (!segment) continue;
    const slug = root === "banks" && !href.endsWith("/exam-style") ? segment : root === "past-papers" ? bankForSubjectSlug(segment) : null;
    if (slug && live.has(slug) && !found.some((item) => item.slug === slug)) found.push({ slug: slug as BankSlug, href });
  }
  return found;
}

/** The board a feature belongs to when it only links to one board's pages (course notes, banks, papers). */
function boardOfUpdate(update: Update): QualificationId | undefined {
  const hrefs = hrefsOf(update).map(({ href }) => href);
  if (!hrefs.length || !hrefs.every((href) => /^\/(banks|past-papers|revision-notes)\/[^/?#]+/.test(href))) return undefined;
  const boards = new Set(hrefs.map((href) => qualificationIdOfSlug(href.split(/[/?#]/)[2])));
  return boards.size === 1 ? [...boards][0] : undefined;
}

/** For an HL/SL pair, the level the reader already studies. */
function preferredVariant(slugs: readonly BankSlug[], owned: ReadonlySet<string>): BankSlug {
  const level = [...owned].some((slug) => slug.endsWith("-sl")) && ![...owned].some((slug) => slug.endsWith("-hl")) ? "-sl" : "-hl";
  return slugs.find((slug) => slug.endsWith(level)) ?? slugs[0];
}

/** When each bank first appeared as a "New bank" update, for the small New dot on bank cards. */
export function bankLaunchDates(updates: readonly Update[] = UPDATES, live: ReadonlySet<string>): Map<BankSlug, string> {
  const dates = new Map<BankSlug, string>();
  for (const update of updates) {
    if (update.tag !== "New bank") continue;
    for (const { slug } of banksOfUpdate(update, live)) if (!dates.has(slug) || dates.get(slug)! > update.date) dates.set(slug, update.date);
  }
  return dates;
}

export function newBankSlugs({ banks, now = new Date(), updates = UPDATES }: { banks: readonly Pick<Bank, "slug">[]; now?: Date; updates?: readonly Update[] }): BankSlug[] {
  const live = new Set(banks.map(({ slug }) => slug));
  return [...bankLaunchDates(updates, live)].filter(([, date]) => withinDays(date, NEW_BANK_DOT_DAYS, now)).map(([slug]) => slug);
}

export type AnnouncementReader = {
  banks: readonly (Pick<Bank, "slug" | "shortName"> & { years?: string })[];
  accessible: readonly BankSlug[];
  /** All Access, Lifetime or a complimentary all-bank grant: new banks are already theirs. */
  allAccess: boolean;
  now?: Date;
  updates?: readonly Update[];
  pepper?: boolean;
};

/** Every update that applies to this reader, newest first within each tier. At most one per update. */
export function announcementCandidates({ banks, accessible, allAccess, now = new Date(), updates = UPDATES, pepper = false }: AnnouncementReader): Announcement[] {
  const live = new Set(banks.map(({ slug }) => slug));
  const owned = new Set<string>(allAccess ? live : accessible);
  const paid = owned.size > 0;
  const ownedBoards = new Set([...accessible].map(qualificationIdOfSlug));
  const name = (slug: BankSlug) => banks.find((bank) => bank.slug === slug)?.shortName ?? slug;
  // One short line instead of the changelog's paragraph: "2020–2026 papers · 2020–2021 free".
  const bankLine = (slug: BankSlug, withFree: boolean) => {
    const years = banks.find((bank) => bank.slug === slug)?.years?.replace("-", "–");
    const free = withFree && hasFreeTier(slug) ? yearRangeLabel(freeQuestionYears(slug) ?? []) : "";
    return [years && `${years} papers`, free && `${free} free`].filter(Boolean).join(" · ") || undefined;
  };
  // Free readers always get a way to upgrade, since their card takes the plan card's place.
  const plans = { label: "See plans", href: "/pricing?from=announcement" };
  const result: Announcement[] = [];
  for (const update of updates) {
    if (!withinDays(update.date, ANNOUNCEMENT_MAX_AGE_DAYS, now)) continue;
    const id = updateId(update);
    const base = { id, title: update.title, date: update.date };
    const linked = banksOfUpdate(update, live);
    if (update.tag === "New bank") {
      if (!linked.length) continue;
      const slugs = linked.map(({ slug }) => slug);
      const board = qualificationIdOfSlug(slugs[0]);
      if (allAccess) {
        result.push({ ...base, body: bankLine(slugs[0], false), kind: "bank_included", eyebrow: "Now included", tier: 0, board, bank: slugs[0], cta: { label: "Open it", href: `/banks/${preferredVariant(slugs, owned)}` } });
      } else if (paid) {
        // Only banks on a board they already study, and only ones they don't have yet.
        const missing = slugs.filter((slug) => !owned.has(slug));
        if (!missing.length || !ownedBoards.has(board)) continue;
        const slug = preferredVariant(missing, owned);
        // A launch of several banks where they own one: name only the new one to them.
        const partial = slugs.some((item) => owned.has(item));
        result.push({ ...base, ...(partial ? { title: name(slug) } : {}), body: bankLine(slug, true), kind: "bank_add", eyebrow: "New bank", tier: 0, board, bank: slug, cta: { label: "Add it to your plan", href: upgradeHref(slug, "announcement") }, secondary: hasFreeTier(slug) ? { label: "Try it free", href: bankEntryHref(slug) } : undefined });
      } else {
        const slug = preferredVariant(slugs, owned);
        result.push({ ...base, body: bankLine(slug, true), kind: "bank_free", eyebrow: "New bank", tier: 0, board, bank: slug, cta: hasFreeTier(slug) ? { label: "Try it free", href: bankEntryHref(slug) } : { label: "Take a look", href: `/banks/${slug}` }, secondary: { label: "Unlock every year", href: upgradeHref(slug, "announcement") } });
      }
    } else if (update.tag === "New papers") {
      const mine = linked.filter(({ slug }) => owned.has(slug));
      if (!mine.length) continue;
      const { slug, href } = mine[0];
      result.push({ ...base, title: name(slug), kind: "new_papers", eyebrow: "New papers", tier: 2, board: qualificationIdOfSlug(slug), bank: slug, cta: { label: href.startsWith("/past-papers") ? "Open papers" : "Practise", href } });
    } else if (update.tag === "Feature" && update.teaser) {
      // Only features written up for students get a card (a teachers' page doesn't).
      const link = hrefsOf(update)[0];
      if (update.action === "pepper") {
        if (!pepper) continue;
        result.push({ ...base, body: update.teaser, kind: "feature", eyebrow: "New", tier: 3, cta: { label: "Ask Pepper", action: "pepper" }, secondary: paid ? undefined : plans });
      } else if (link && !link.href.startsWith("http")) {
        result.push({ ...base, body: update.teaser, kind: "feature", eyebrow: "New", tier: 3, board: boardOfUpdate(update), cta: link, secondary: paid ? undefined : plans });
      }
    }
  }
  return result;
}

