import { describe, expect, it } from "vitest";
import { announcementCandidates, annualAnnouncement, annualOfferFrom, isDismissed, newBankSlugs, pickAnnouncement, pruneDismissals, type Announcement } from "@/lib/announcements";
import type { Bank, BankSlug } from "@/lib/banks";
import type { Update } from "@/lib/updates";

const NOW = new Date("2026-11-26T12:00:00Z");
const bank = (slug: string, shortName: string) => ({ slug: slug as BankSlug, shortName }) satisfies Pick<Bank, "slug" | "shortName">;
const BANKS = [
  bank("igcse", "Mathematics 0580"),
  bank("igcse-biology-0610", "Biology 0610"),
  bank("ib-chemistry-hl", "Chemistry HL"),
  bank("ib-chemistry-sl", "Chemistry SL"),
  bank("ib-business-management-hl", "Business Management HL"),
  bank("ib-business-management-sl", "Business Management SL"),
  bank("a-level-computer-science-9618", "Computer Science 9618"),
];
const pair = (slug: string) => ({ label: "Practise by topic", options: [{ label: "HL", href: `/banks/${slug}-hl` }, { label: "SL", href: `/banks/${slug}-sl` }] });
const UPDATES: Update[] = [
  { date: "2026-11-25", tag: "Feature", title: "Ask Pepper", body: "A study helper.", action: "pepper" },
  { date: "2026-11-24", tag: "New bank", title: "IB Business Management HL and SL", body: "New bank.", links: [pair("ib-business-management")] },
  { date: "2026-11-22", tag: "New papers", title: "Full Computer Science papers", body: "Papers.", links: [{ label: "Computer Science 9618", href: "/past-papers/a-level-computer-science-9618" }] },
  { date: "2026-11-20", tag: "Improvement", title: "A fix", body: "Fixed." },
  { date: "2026-11-10", tag: "Feature", title: "IB Chemistry course notes", body: "Notes.", links: [{ label: "Read the notes", href: "/revision-notes/ib-chemistry" }] },
  { date: "2026-10-20", tag: "New bank", title: "Old bank", body: "Too old.", links: [{ label: "Biology", href: "/banks/igcse-biology-0610" }] },
  { date: "2026-12-01", tag: "New bank", title: "Future bank", body: "Not yet.", links: [{ label: "Biology", href: "/banks/igcse-biology-0610" }] },
];
const candidates = (accessible: string[], allAccess = false, pepper = true) =>
  announcementCandidates({ banks: BANKS, accessible: accessible as BankSlug[], allAccess, now: NOW, updates: UPDATES, pepper });
const ids = (items: readonly Announcement[]) => items.map((item) => `${item.kind}:${item.title}`);

describe("announcement candidates", () => {
  it("offers a new bank on the reader's board as an add-on, at the level they study", () => {
    const [card] = candidates(["ib-chemistry-sl"]).filter((item) => item.kind === "bank_add");
    expect(card).toMatchObject({ eyebrow: "New bank", bank: "ib-business-management-sl", board: "ib", id: "2026-11-24-ib-business-management-hl-and-sl" });
    expect(card.cta).toEqual({ label: "Add it to your plan", href: "/pricing?product=bank_ib_business_management_sl&from=announcement" });
    expect(card.secondary).toEqual({ label: "Try it free", href: "/banks/ib-business-management-sl?free=1" });
  });

  it("doesn't advertise a new bank on another board, or one the reader already has", () => {
    expect(ids(candidates(["igcse"]))).not.toContain("bank_add:IB Business Management HL and SL");
    expect(candidates(["ib-business-management-hl", "ib-business-management-sl"]).some((item) => item.kind === "bank_add")).toBe(false);
  });

  it("names only the bank that is new to a reader who owns part of a launch", () => {
    const launch: Update = { date: "2026-11-22", tag: "New bank", title: "A Level Computer Science 9618 and Further Maths 9231", body: "Both.", links: [{ label: "CS", href: "/banks/a-level-computer-science-9618" }, { label: "FM", href: "/banks/a-level-further-maths-9231" }] };
    const banks = [...BANKS, bank("a-level-further-maths-9231", "Further Maths 9231")];
    const [card] = announcementCandidates({ banks, accessible: ["a-level-computer-science-9618"], allAccess: false, now: NOW, updates: [launch] });
    expect(card).toMatchObject({ kind: "bank_add", title: "Further Maths 9231", body: undefined, bank: "a-level-further-maths-9231" });
  });

  it("tells All Access and Lifetime readers the bank is already theirs", () => {
    const card = candidates(BANKS.map(({ slug }) => slug), true).find((item) => item.kind === "bank_included");
    expect(card).toMatchObject({ eyebrow: "Now included", cta: { label: "Open it", href: "/banks/ib-business-management-hl" } });
  });

  it("gives free readers the free years plus a way to unlock the rest", () => {
    const card = candidates([]).find((item) => item.kind === "bank_free");
    expect(card?.cta).toEqual({ label: "Try it free", href: "/banks/ib-business-management-hl?free=1" });
    expect(card?.secondary).toEqual({ label: "Unlock every year", href: "/pricing?product=bank_ib_business_management_hl&from=announcement" });
  });

  it("announces new papers only to readers who own the bank", () => {
    expect(candidates(["igcse"]).some((item) => item.kind === "new_papers")).toBe(false);
    expect(candidates([]).some((item) => item.kind === "new_papers")).toBe(false);
    const card = candidates(["a-level-computer-science-9618"]).find((item) => item.kind === "new_papers");
    expect(card).toMatchObject({ eyebrow: "New papers in Computer Science 9618", board: "a-level", cta: { label: "Open papers", href: "/past-papers/a-level-computer-science-9618" } });
  });

  it("skips fixes, entries over a month old and future entries", () => {
    const titles = candidates([]).map((item) => item.title);
    expect(titles).not.toContain("A fix");
    expect(titles).not.toContain("Old bank");
    expect(titles).not.toContain("Future bank");
  });

  it("opens Pepper only when the helper is configured, and tags board-only features with their board", () => {
    expect(candidates([]).find((item) => item.title === "Ask Pepper")?.cta).toEqual({ label: "Ask Pepper", action: "pepper" });
    expect(candidates([], false, false).some((item) => item.title === "Ask Pepper")).toBe(false);
    expect(candidates([]).find((item) => item.title === "IB Chemistry course notes")).toMatchObject({ board: "ib", cta: { label: "Read the notes", href: "/revision-notes/ib-chemistry" } });
  });

  it("finds IB Business Management in the real changelog for an IB subscriber", () => {
    const live = [...BANKS];
    const real = announcementCandidates({ banks: live, accessible: ["ib-chemistry-hl"], allAccess: false, now: NOW });
    expect(real.find((item) => item.kind === "bank_add")?.title).toBe("IB Business Management HL and SL");
  });
});

describe("picking one card", () => {
  const all = candidates(["ib-chemistry-hl", "a-level-computer-science-9618"]);

  it("leads with a new bank, then new papers, then features", () => {
    expect(pickAnnouncement(all, { now: NOW })?.kind).toBe("bank_add");
    const dismissed = { "2026-11-24-ib-business-management-hl-and-sl": NOW.getTime() };
    expect(pickAnnouncement(all, { dismissals: dismissed, now: NOW })?.kind).toBe("new_papers");
  });

  it("puts the annual nudge after new banks and before papers", () => {
    const annual = annualAnnouncement({ percent: 33, monthlyCents: 600, annualCents: 4800 }, NOW);
    expect(pickAnnouncement([...all, annual], { now: NOW })?.kind).toBe("bank_add");
    expect(pickAnnouncement([...all, annual], { dismissals: { "2026-11-24-ib-business-management-hl-and-sl": 1 }, now: NOW })?.kind).toBe("annual");
  });

  it("drops cards for other boards once the reader's board is known", () => {
    const free = candidates([]);
    const igcse = pickAnnouncement(free, { boards: ["igcse"], now: NOW });
    expect(igcse?.title).toBe("Ask Pepper");
    expect(pickAnnouncement(free, { boards: ["ib"], now: NOW })?.kind).toBe("bank_free");
  });

  it("keeps update dismissals for good but brings the annual nudge back after 60 days", () => {
    const at = NOW.getTime();
    expect(isDismissed("2026-11-24-x", { "2026-11-24-x": at - 100 * 86_400_000 }, NOW)).toBe(true);
    expect(isDismissed("annual", { annual: at - 59 * 86_400_000 }, NOW)).toBe(true);
    expect(isDismissed("annual", { annual: at - 61 * 86_400_000 }, NOW)).toBe(false);
    expect(pruneDismissals({ old: at - 200 * 86_400_000, recent: at - 86_400_000 }, NOW)).toEqual({ recent: at - 86_400_000 });
  });
});

describe("annual offer", () => {
  const snapshot = (overrides: { sub?: Record<string, unknown>; item?: Record<string, unknown>; editable?: boolean; extra?: unknown[] } = {}) => ({
    management: { editable: overrides.editable ?? true },
    subscriptions: [{
      status: "active", cancelAtPeriodEnd: false, pendingUpdate: false, scheduledChange: false,
      bankSelection: { kind: "selected", banks: [{ slug: "igcse", name: "Mathematics 0580" }] },
      items: [{ recurringSubtotalCents: 600, price: { currency: "usd", interval: "month", intervalCount: 1 }, ...overrides.item }],
      ...overrides.sub,
    }, ...(overrides.extra ?? [])],
  });

  it("compares the reader's monthly charge with the same plan billed yearly", () => {
    expect(annualOfferFrom(snapshot())).toEqual({ percent: 33, monthlyCents: 600, annualCents: 4800 });
    const three = snapshot({ sub: { bankSelection: { kind: "selected", banks: [1, 2, 3] } }, item: { recurringSubtotalCents: 1400 } });
    expect(annualOfferFrom(three)).toEqual({ percent: 29, monthlyCents: 1400, annualCents: 12000 });
    expect(annualOfferFrom(snapshot({ sub: { bankSelection: { kind: "all" } }, item: { recurringSubtotalCents: 2500 } }))?.percent).toBe(28);
  });

  it("stays quiet unless there is exactly one editable, active, monthly plan with nothing scheduled", () => {
    expect(annualOfferFrom(snapshot({ item: { price: { currency: "usd", interval: "year", intervalCount: 1 } } }))).toBeNull();
    expect(annualOfferFrom(snapshot({ editable: false }))).toBeNull();
    expect(annualOfferFrom(snapshot({ sub: { cancelAtPeriodEnd: true } }))).toBeNull();
    expect(annualOfferFrom(snapshot({ sub: { scheduledChange: true } }))).toBeNull();
    expect(annualOfferFrom(snapshot({ sub: { pendingUpdate: true } }))).toBeNull();
    expect(annualOfferFrom(snapshot({ sub: { bankSelection: { kind: "unknown" } } }))).toBeNull();
    expect(annualOfferFrom(snapshot({ extra: [{ status: "active", items: [] }] }))).toBeNull();
    expect(annualOfferFrom(snapshot({ extra: [{ status: "canceled", items: [] }] }))).not.toBeNull();
    expect(annualOfferFrom(null)).toBeNull();
    expect(annualOfferFrom({ error: "No billing account found" })).toBeNull();
  });

  it("writes the nudge from real prices and links to the plan editor's annual view", () => {
    const card = annualAnnouncement({ percent: 33, monthlyCents: 600, annualCents: 4800 }, NOW);
    expect(card).toMatchObject({ id: "annual", title: "Switch to annual and save 33%", body: "$48 a year instead of $72.", cta: { label: "Switch to annual", href: "/pricing?interval=annual&from=announcement" } });
  });
});

describe("new bank dot", () => {
  it("marks banks launched in the last 21 days", () => {
    expect(newBankSlugs({ banks: BANKS, now: NOW, updates: UPDATES }).sort()).toEqual(["ib-business-management-hl", "ib-business-management-sl"]);
    expect(newBankSlugs({ banks: BANKS, now: new Date("2026-12-20T00:00:00Z"), updates: UPDATES })).toEqual([]);
  });
});
