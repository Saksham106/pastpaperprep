import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SubscriptionExitFlow } from "@/components/SubscriptionExitFlow";

afterEach(() => vi.unstubAllGlobals());
const ok = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });
const billing = (overrides: Record<string, unknown> = {}, pauseEnabled = true) => ({ subscriptions: [{ id: "sub_1", status: "active", cancelAtPeriodEnd: false, pause: { kind: "none" }, bankSelection: { kind: "selected", banks: [{ slug: "igcse", name: "IGCSE Mathematics" }] }, items: [{ recurringSubtotalCents: 600, price: { currency: "usd", interval: "month" }, currentPeriodEnd: "2026-12-26T00:00:00Z" }], ...overrides }], management: { editable: true, pauseEnabled } });
const decision = (offer: unknown, pauseAvailable = true) => ({ offer, eligibleOffer: offer, basis: "too_expensive", predicted: false, holdout: offer === null, pauseAvailable });
const body = (fetch: ReturnType<typeof vi.fn>, call: number) => JSON.parse(fetch.mock.calls[call][1].body);

describe("subscription exit flow", () => {
  it("makes keeping the subscription the primary action and the reason optional", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok(billing())));
    render(<SubscriptionExitFlow start="cancel" />);
    expect(await screen.findByRole("heading", { name: "Why are you thinking of leaving?" })).toBeInTheDocument();
    const keep = screen.getByRole("link", { name: "Keep my subscription" });
    expect(keep).toHaveAttribute("href", "/account/billing#subscription");
    expect(keep.compareDocumentPosition(screen.getByRole("button", { name: "Continue" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "I’m switching to another service" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Need a break?" })).toBeInTheDocument();
  });
  it("goes reason → offer → confirm, sending the reason and the 'Something else' comment", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(ok(billing())).mockResolvedValueOnce(ok(decision(null))).mockResolvedValueOnce(ok({ status: "canceling", cancelAtPeriodEnd: true, effectiveAt: "2026-12-26T00:00:00Z" }));
    vi.stubGlobal("fetch", fetch);
    render(<SubscriptionExitFlow start="cancel" />);
    fireEvent.click(await screen.findByRole("radio", { name: "Something else" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Using my school's notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    // Holdout: no reason-based offer, but pause is still offered.
    expect(await screen.findByRole("heading", { name: "Take a break instead" })).toBeInTheDocument();
    expect(body(fetch, 1)).toEqual({ intent: "offer", reason: "other" });
    fireEvent.click(screen.getByRole("button", { name: "Continue to cancel" }));
    expect(screen.getByRole("heading", { name: "Cancel your subscription?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel subscription" }));
    expect(await screen.findByRole("heading", { name: "Your subscription is cancelled" })).toBeInTheDocument();
    expect(body(fetch, 2)).toEqual({ intent: "cancel", reason: "other", comment: "Using my school's notes" });
    expect(screen.getByRole("button", { name: "Undo cancellation" })).toBeEnabled();
  });
  it("shows the discount and pause side by side", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(ok(billing())).mockResolvedValueOnce(ok(decision({ kind: "discount", percentOff: 30 }))).mockResolvedValueOnce(ok({ status: "discount_applied", percentOff: 30, nextPaymentAt: "2026-12-26T00:00:00Z" }));
    vi.stubGlobal("fetch", fetch);
    render(<SubscriptionExitFlow start="cancel" />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "30% off your next month" })).toBeInTheDocument();
    expect(screen.getByText(/Pay \$4.20 instead of \$6.00 on Dec 26, 2026/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Need a break?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to cancel" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Take 30% off" }));
    expect(await screen.findByText(/30% off your next payment on Dec 26, 2026/)).toBeInTheDocument();
    expect(body(fetch, 2)).toEqual({ intent: "accept_discount" });
  });
  it("tells multi-bank students how many banks they have when offering fewer", async () => {
    const three = { kind: "selected", banks: [{ slug: "igcse", name: "IGCSE Mathematics" }, { slug: "ib-hl", name: "IB Math AA HL" }, { slug: "ib-sl", name: "IB Math AA SL" }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok(billing({ bankSelection: three })))
      .mockResolvedValueOnce(ok({ ...decision({ kind: "fewer_banks" }), basis: "not_studying" })));
    render(<SubscriptionExitFlow start="cancel" />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByText("You have 3 banks. Keep only the ones you still use, from $6/month.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose banks" })).toHaveAttribute("href", "/pricing");
  });
  it("pauses for the chosen length from the pause page", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(ok(billing())).mockResolvedValueOnce(ok({ status: "pause_scheduled", months: 2, accessUntil: "2026-12-26T00:00:00.000Z", resumesAt: "2027-02-26T00:00:00.000Z" }));
    vi.stubGlobal("fetch", fetch);
    render(<SubscriptionExitFlow start="pause" />);
    expect(await screen.findByRole("heading", { name: "Pause your subscription" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /2 months/ }));
    expect(screen.getByRole("radio", { name: /2 months/ }).closest("label")).toHaveTextContent("Back Feb 26, 2027");
    fireEvent.click(screen.getByRole("button", { name: "Pause for 2 months" }));
    expect(await screen.findByRole("heading", { name: "Your pause is booked" })).toBeInTheDocument();
    expect(body(fetch, 1)).toEqual({ intent: "pause", months: 2 });
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
    expect(screen.getByText(/Back on Feb 26, 2027 at \$6.00\/month/)).toBeInTheDocument();
  });
  it("hides pause for annual plans and never blocks cancelling when the offer lookup fails", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(ok(billing({ items: [{ recurringSubtotalCents: 4800, price: { currency: "usd", interval: "year" }, currentPeriodEnd: "2026-12-26T00:00:00Z" }] }))).mockResolvedValueOnce(ok({ error: "down" }, 503));
    vi.stubGlobal("fetch", fetch);
    render(<SubscriptionExitFlow start="cancel" />);
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Cancel your subscription?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pause instead" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("shows a booked pause or cancellation instead of starting over", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok(billing({ cancelAtPeriodEnd: true }))));
    const { unmount } = render(<SubscriptionExitFlow start="cancel" />);
    expect(await screen.findByRole("heading", { name: "Your subscription is cancelled" })).toBeInTheDocument();
    unmount();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok(billing({ pause: { kind: "paused", accessUntil: "2026-12-26T00:00:00Z", resumesAt: "2027-01-26T00:00:00Z" } }))));
    render(<SubscriptionExitFlow start="pause" />);
    expect(await screen.findByRole("heading", { name: "You’re on a break" })).toBeInTheDocument();
  });
  it("still lets a paused student cancel from the cancel page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok(billing({ pause: { kind: "paused", accessUntil: "2026-12-26T00:00:00Z", resumesAt: "2027-01-26T00:00:00Z" } }))));
    render(<SubscriptionExitFlow start="cancel" />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel subscription" }));
    expect(screen.getByRole("heading", { name: "Cancel your subscription?" })).toBeInTheDocument();
  });
  it("sends unsupported billing arrangements to support", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(ok({ subscriptions: [], management: { editable: false } })));
    render(<SubscriptionExitFlow start="cancel" />);
    expect(await screen.findByRole("heading", { name: "We can’t change this plan here" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("hello@pastpaperprep.com")).toBeInTheDocument());
  });
});
