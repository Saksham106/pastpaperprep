import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardAnnouncement } from "@/components/DashboardAnnouncement";
import type { Announcement } from "@/lib/announcement-pick";
import { PEPPER_OPEN_EVENT } from "@/lib/helper/site-config";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: track }));

const bankCard: Announcement = {
  id: "2026-11-24-ib-business-management-hl-and-sl", kind: "bank_add", eyebrow: "New bank", title: "IB Business Management HL and SL", body: "260 HL and 218 SL questions.",
  tier: 0, date: "2026-11-24", board: "ib", bank: "ib-business-management-hl",
  cta: { label: "Add it to your plan", href: "/pricing?product=bank_ib_business_management_hl&from=announcement" },
  secondary: { label: "Try it free", href: "/banks/ib-business-management-hl?free=1" },
};
const pepperCard: Announcement = { id: "2026-11-25-ask-pepper", kind: "feature", eyebrow: "New", title: "Ask Pepper", tier: 3, date: "2026-11-25", cta: { label: "Ask Pepper", action: "pepper" } };
const monthlySnapshot = {
  management: { editable: true },
  subscriptions: [{ status: "active", cancelAtPeriodEnd: false, bankSelection: { kind: "selected", banks: [{ slug: "igcse", name: "Mathematics 0580" }] }, items: [{ recurringSubtotalCents: 600, price: { currency: "usd", interval: "month", intervalCount: 1 } }] }],
};

describe("DashboardAnnouncement", () => {
  beforeEach(() => { window.localStorage.clear(); track.mockClear(); });
  afterEach(() => vi.unstubAllGlobals());

  it("shows one card, counts the view and the click", async () => {
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard, bankCard]} boards={["ib"]} annualCheck={false} tones={{ "ib-business-management-hl": "economics" }} />);
    const card = await screen.findByRole("complementary", { name: "For you" });
    expect(card).toHaveTextContent("New bank");
    expect(card).toHaveTextContent("IB Business Management HL and SL");
    expect(card).toHaveAttribute("data-subject-tone", "economics");
    expect(screen.queryByText("Ask Pepper")).not.toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("announcement_view", { updateId: bankCard.id, type: "bank_add", bank: "ib-business-management-hl" });
    const cta = screen.getByRole("link", { name: /add it to your plan/i });
    expect(cta).toHaveAttribute("href", "/pricing?product=bank_ib_business_management_hl&from=announcement");
    const secondary = screen.getByRole("link", { name: "Try it free" });
    secondary.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(secondary);
    expect(track).toHaveBeenCalledWith("announcement_click", { updateId: bankCard.id, type: "bank_add", bank: "ib-business-management-hl", target: "secondary" });
  });

  it("remembers a dismissal per account and shows the next card on the next visit", async () => {
    const { unmount } = render(<DashboardAnnouncement userId="u1" candidates={[pepperCard, bankCard]} boards={[]} annualCheck={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss: IB Business Management HL and SL" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("announcement_dismiss", expect.objectContaining({ updateId: bankCard.id, type: "bank_add" }));
    expect(Object.keys(JSON.parse(window.localStorage.getItem("ppp-announcements:u1")!))).toEqual([bankCard.id]);
    unmount();

    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard, bankCard]} boards={[]} annualCheck={false} />);
    expect(await screen.findByRole("complementary", { name: "For you" })).toHaveTextContent("Ask Pepper");
  });

  it("keeps another account's dismissals separate", async () => {
    window.localStorage.setItem("ppp-announcements:u2", JSON.stringify({ [bankCard.id]: Date.now() }));
    render(<DashboardAnnouncement userId="u1" candidates={[bankCard]} boards={[]} annualCheck={false} />);
    expect(await screen.findByRole("complementary")).toHaveTextContent("IB Business Management");
  });

  it("prefers the remembered board for free readers", async () => {
    window.localStorage.setItem("ppp-qualification", "igcse");
    render(<DashboardAnnouncement userId="u1" candidates={[bankCard, pepperCard]} boards={[]} annualCheck={false} />);
    expect(await screen.findByRole("complementary")).toHaveTextContent("Ask Pepper");
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
    const card = await screen.findByText("Switch to annual and save 33%");
    expect(card.closest("aside")).toHaveTextContent("$4 a month instead of $6, billed yearly.");
    expect(screen.getByRole("link", { name: /switch to annual/i })).toHaveAttribute("href", "/pricing?interval=annual&from=announcement");
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/subscription", expect.objectContaining({ cache: "no-store" }));
    // The lower Pepper card never flashed (or counted a view) while billing was checked.
    expect(track.mock.calls.filter(([name]) => name === "announcement_view")).toEqual([["announcement_view", { updateId: "annual", type: "annual", bank: undefined }]]);
    unmount();

    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={["igcse"]} annualCheck />);
    await screen.findByText("Switch to annual and save 33%");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't read billing while a new bank is waiting, or for accounts without a subscription", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(monthlySnapshot), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<DashboardAnnouncement userId="u1" candidates={[bankCard]} boards={["ib"]} annualCheck />);
    await screen.findByText("IB Business Management HL and SL");
    unmount();
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={[]} annualCheck={false} />);
    await screen.findByText("Ask Pepper", { selector: "strong" });
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it("shows the fallback (the free plan card) only when there is no card, and leaves the slot empty after a dismissal", async () => {
    const plan = <p>Free plan</p>;
    const { unmount } = render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={[]} annualCheck={false} fallback={plan} />);
    await screen.findByRole("complementary", { name: "For you" });
    expect(screen.queryByText("Free plan")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss: Ask Pepper" }));
    expect(screen.queryByText("Free plan")).not.toBeInTheDocument();
    unmount();
    render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={[]} annualCheck={false} fallback={plan} />);
    expect(await screen.findByText("Free plan")).toBeInTheDocument();
  });

  it("renders nothing when every card is dismissed", async () => {
    window.localStorage.setItem("ppp-announcements:u1", JSON.stringify({ [pepperCard.id]: Date.now() }));
    const { container } = render(<DashboardAnnouncement userId="u1" candidates={[pepperCard]} boards={[]} annualCheck={false} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(track).not.toHaveBeenCalled();
  });
});
