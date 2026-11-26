import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardAnnouncement, SLIDE_MS } from "@/components/DashboardAnnouncement";
import type { Announcement } from "@/lib/announcement-pick";
import { PEPPER_OPEN_EVENT } from "@/lib/helper/site-config";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));

const bankCard: Announcement = {
  id: "2026-11-24-ib-business-management-hl-and-sl", kind: "bank_add", eyebrow: "New bank", title: "IB Business Management HL and SL", body: "2020–2026 papers · 2020–2021 free",
  tier: 0, date: "2026-11-24", board: "ib", bank: "ib-business-management-hl",
  cta: { label: "Add it to your plan", href: "/pricing?product=bank_ib_business_management_hl&from=announcement" },
  secondary: { label: "Try it free", href: "/banks/ib-business-management-hl?free=1" },
};
const pepperCard: Announcement = { id: "2026-11-25-ask-pepper", kind: "feature", eyebrow: "New", title: "Ask Pepper", tier: 3, date: "2026-11-25", cta: { label: "Ask Pepper", action: "pepper" } };
const papersCard: Announcement = { id: "2026-11-22-papers", kind: "new_papers", eyebrow: "New papers", title: "Computer Science 9618", tier: 2, date: "2026-11-22", cta: { label: "Open papers", href: "/past-papers/a-level-computer-science-9618" } };
const monthlySnapshot = {
  management: { editable: true },
  subscriptions: [{ status: "active", cancelAtPeriodEnd: false, bankSelection: { kind: "selected", banks: [{ slug: "igcse", name: "Mathematics 0580" }] }, items: [{ recurringSubtotalCents: 600, price: { currency: "usd", interval: "month", intervalCount: 1 } }] }],
};
/** The slide on show: the others are hidden from assistive tech and can't be focused. */
const shown = () => screen.getByRole("group");
const views = () => track.mock.calls.filter(([name]) => name === "announcement_view").map(([, props]) => props.updateId);

describe("DashboardAnnouncement", () => {
  beforeEach(() => { window.localStorage.clear(); track.mockClear(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("slides up to three cards, best first, and counts a view only for the card on show", async () => {
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard, papersCard, bankCard]} boards={["ib", "a-level"]} annualCheck={false} tones={{ "ib-business-management-hl": "economics" }} />);
    const strip = await screen.findByRole("complementary", { name: "For you" });
    expect(strip).toHaveAttribute("aria-roledescription", "carousel");
    expect(shown()).toHaveAccessibleName("1 of 3");
    expect(shown()).toHaveTextContent("IB Business Management HL and SL");
    expect(shown()).toHaveAttribute("data-subject-tone", "economics");
    expect(within(strip).getAllByRole("button", { name: /show update/i })).toHaveLength(3);
    expect(views()).toEqual([bankCard.id]);
    expect(track).toHaveBeenCalledWith("announcement_view", { updateId: bankCard.id, type: "bank_add", bank: "ib-business-management-hl", position: 1 });

    const secondary = within(shown()).getByRole("link", { name: "Try it free" });
    secondary.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(secondary);
    expect(track).toHaveBeenCalledWith("announcement_click", { updateId: bankCard.id, type: "bank_add", bank: "ib-business-management-hl", target: "secondary", position: 1 });

    fireEvent.click(within(strip).getByRole("button", { name: "Show update 3 of 3" }));
    expect(shown()).toHaveTextContent("Ask Pepper");
    expect(views()).toEqual([bankCard.id, pepperCard.id]);
  });

  it("moves on by itself once round, then rests on the first card", async () => {
    vi.useFakeTimers();
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard, bankCard]} boards={[]} annualCheck={false} />);
    await act(async () => {});
    expect(shown()).toHaveTextContent("IB Business Management");
    act(() => { vi.advanceTimersByTime(SLIDE_MS); });
    expect(shown()).toHaveTextContent("Ask Pepper");
    act(() => { vi.advanceTimersByTime(SLIDE_MS); });
    expect(shown()).toHaveTextContent("IB Business Management");
    act(() => { vi.advanceTimersByTime(SLIDE_MS * 3); });
    expect(shown()).toHaveTextContent("IB Business Management");
    expect(screen.getByRole("button", { name: "Play updates" })).toBeInTheDocument();
  });

  it("stops moving when the reader points at it, swipes, or pauses it", async () => {
    vi.useFakeTimers();
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard, bankCard]} boards={[]} annualCheck={false} />);
    await act(async () => {});
    const strip = screen.getByRole("complementary", { name: "For you" });
    fireEvent.mouseEnter(strip);
    act(() => { vi.advanceTimersByTime(SLIDE_MS * 2); });
    expect(shown()).toHaveTextContent("IB Business Management");
    fireEvent.mouseLeave(strip);
    fireEvent.click(screen.getByRole("button", { name: "Pause updates" }));
    act(() => { vi.advanceTimersByTime(SLIDE_MS * 2); });
    expect(shown()).toHaveTextContent("IB Business Management");
    fireEvent.click(screen.getByRole("button", { name: "Play updates" }));
    act(() => { vi.advanceTimersByTime(SLIDE_MS); });
    expect(shown()).toHaveTextContent("Ask Pepper");
    fireEvent.pointerDown(strip.querySelector(".dashboard-announcements-track")!);
    act(() => { vi.advanceTimersByTime(SLIDE_MS * 2); });
    expect(shown()).toHaveTextContent("Ask Pepper");
  });

  it("never moves by itself for readers who prefer reduced motion", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), addEventListener() {}, removeEventListener() {} }));
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard, bankCard]} boards={[]} annualCheck={false} />);
    await act(async () => {});
    act(() => { vi.advanceTimersByTime(SLIDE_MS * 3); });
    expect(shown()).toHaveTextContent("IB Business Management");
    expect(screen.queryByRole("button", { name: /pause updates/i })).not.toBeInTheDocument();
  });

  it("drops a dismissed card from the strip, remembers it per account, and leaves the slot empty once all are gone", async () => {
    const plan = <p>Free plan</p>;
    const { unmount } = render(<DashboardAnnouncement userId="u1" candidates={[pepperCard, bankCard]} boards={[]} annualCheck={false} fallback={plan} />);
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss: IB Business Management HL and SL" }));
    expect(track).toHaveBeenCalledWith("announcement_dismiss", expect.objectContaining({ updateId: bankCard.id, type: "bank_add" }));
    expect(screen.getByRole("complementary", { name: "For you" })).toHaveTextContent("Ask Pepper");
    expect(screen.getByRole("complementary")).not.toHaveTextContent("IB Business Management");
    expect(Object.keys(JSON.parse(window.localStorage.getItem("ppp-announcements:u1")!))).toEqual([bankCard.id]);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Ask Pepper" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByText("Free plan")).not.toBeInTheDocument();
    unmount();

    // Next visit: nothing left to announce, so the free plan card is back.
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard, bankCard]} boards={[]} annualCheck={false} fallback={plan} />);
    expect(await screen.findByText("Free plan")).toBeInTheDocument();
  });

  it("keeps another account's dismissals separate", async () => {
    window.localStorage.setItem("ppp-announcements:u2", JSON.stringify({ [bankCard.id]: Date.now() }));
    render(<DashboardAnnouncement userId="u1" candidates={[bankCard]} boards={[]} annualCheck={false} />);
    expect(await screen.findByRole("complementary")).toHaveTextContent("IB Business Management");
  });

  it("prefers the remembered board for free readers", async () => {
    window.localStorage.setItem("ppp-qualification", "igcse");
    render(<DashboardAnnouncement userId="u1" candidates={[bankCard, pepperCard]} boards={[]} annualCheck={false} />);
    const strip = await screen.findByRole("complementary");
    expect(strip).toHaveTextContent("Ask Pepper");
    expect(strip).not.toHaveTextContent("IB Business Management");
    // One card: no dots or pause control.
    expect(within(strip).queryByRole("button", { name: /show update|pause/i })).not.toBeInTheDocument();
  });

  it("opens Pepper from its card", async () => {
    const opened = vi.fn();
    window.addEventListener(PEPPER_OPEN_EVENT, opened);
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={[]} annualCheck={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ask Pepper" }));
    expect(opened).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("announcement_click", expect.objectContaining({ updateId: pepperCard.id, target: "primary" }));
    window.removeEventListener(PEPPER_OPEN_EVENT, opened);
  });

  it("nudges a monthly subscriber to annual from their real price, and checks billing at most weekly", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(monthlySnapshot), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={["igcse"]} annualCheck />);
    await screen.findByText("Switch to annual and save 33%");
    expect(shown()).toHaveTextContent("$4 a month instead of $6, billed yearly.");
    expect(within(shown()).getByRole("link", { name: /switch to annual/i })).toHaveAttribute("href", "/pricing?interval=annual&from=announcement");
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/subscription", expect.objectContaining({ cache: "no-store" }));
    // The strip waited for billing, so the nudge leads and nothing was counted before it arrived.
    expect(views()).toEqual(["annual"]);
    unmount();

    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={["igcse"]} annualCheck />);
    await screen.findByText("Switch to annual and save 33%");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never reads billing for accounts without a subscription", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(monthlySnapshot), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={[]} annualCheck={false} />);
    await screen.findByText("Ask Pepper", { selector: "strong" });
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it("renders nothing when every card is dismissed", async () => {
    window.localStorage.setItem("ppp-announcements:u1", JSON.stringify({ [pepperCard.id]: Date.now() }));
    const { container } = render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={[]} annualCheck={false} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(track).not.toHaveBeenCalled();
  });
});
