import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AccountSubscriptionEditor } from "@/components/AccountSubscriptionEditor";

afterEach(() => vi.unstubAllGlobals());
const banks = [{ slug: "ib-hl", name: "IB Math AA HL" }, { slug: "igcse", name: "IGCSE Mathematics" }, { slug: "ib-sl", name: "IB Math AA SL" }];
const plan = (cancelAtPeriodEnd = false) => ({ id: "sub_one", cancelAtPeriodEnd, bankSelection: { kind: "selected" as const, banks: [banks[0]] }, item: { quantity: 1, currentPeriodEnd: "2026-10-25T00:00:00Z", price: { interval: "month" } } });
const snapshot = { prorationDate: Math.floor(Date.now() / 1000), amountDueTodayCents: 380, estimatedCreditCents: 200, estimatedTaxesCents: 0, currency: "usd", currentSubscriptionId: "sub_one", currentItemId: "si_one", currentPriceId: "price_one", currentQuantity: 1, periodEnd: 1792886400, targetPriceId: "price_two", targetQuantity: 2, selectedBankIds: ["ib-hl", "igcse"], allAccess: false, interval: "monthly" };
const preview = { estimate: { amountDueTodayCents: 380, estimatedCreditCents: 200, estimatedTaxesCents: 0, recurringSubtotalCents: 1000, currency: "usd", isEstimate: true }, target: { productId: "bundle_custom", selectedBankIds: ["ib-hl", "igcse"], interval: "monthly", renewalAt: "2026-10-25T00:00:00Z" }, snapshot };
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });

describe("account subscription editor", () => {
  it("keeps the local UI demo interactive without exposing a billing mutation", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(<AccountSubscriptionEditor subscription={plan()} bankOptions={banks} onUpdated={vi.fn()} demo />);
    fireEvent.click(screen.getByRole("button", { name: "Select Build Your Plan" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "IGCSE Mathematics" }));
    expect(screen.getByText(/preview only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review change" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel subscription" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows three price cards, highlights the current plan, and reprices a builder selection before any Stripe request", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(<AccountSubscriptionEditor subscription={plan()} bankOptions={banks} onUpdated={vi.fn()} />);
    const one = screen.getByRole("heading", { name: "One Bank" }).closest("article")!;
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")!;
    expect(screen.getByLabelText("PastPaperPrep plans")).toHaveClass("pricing-decision-grid");
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(one).toHaveClass("pricing-option");
    expect(one.querySelector("img.plan-art")).toHaveAttribute("src", expect.stringContaining("aristotle-tutoring-alexander"));
    expect(builder.querySelector("img.plan-art")).toHaveAttribute("src", expect.stringContaining("school-of-athens-plato-aristotle"));
    expect(screen.getByRole("group", { name: "Billing period" })).toBeInTheDocument();
    expect(one).toHaveAttribute("data-current-plan", "true");
    expect(one.querySelector(".account-plan-card-price")).toHaveTextContent("$6/ month");
    fireEvent.click(within(builder).getByRole("button", { name: "Select Build Your Plan" }));
    expect(builder.querySelector(".account-plan-card-price")).toHaveTextContent("$10/ month");
    fireEvent.click(screen.getByRole("checkbox", { name: "IGCSE Mathematics" }));
    expect(builder.querySelector(".account-plan-card-price")).toHaveTextContent("$10/ month");
    fireEvent.click(screen.getByRole("button", { name: /Annual Save up to/i }));
    expect(builder.querySelector(".account-plan-card-price")).toHaveTextContent("$7/ month");
    expect(within(builder).getByText(/Billed \$84 once a year/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("unchecks an existing bank on the first click even when opening an inactive builder card", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(<AccountSubscriptionEditor subscription={plan()} bankOptions={banks} onUpdated={vi.fn()} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")!;
    fireEvent.click(within(builder).getByRole("checkbox", { name: "IB Math AA HL" }));
    expect(within(builder).getByRole("checkbox", { name: "IB Math AA HL" })).not.toBeChecked();
    fireEvent.click(within(builder).getByRole("checkbox", { name: "IGCSE Mathematics" }));
    fireEvent.click(within(builder).getByRole("checkbox", { name: "IB Math AA SL" }));
    expect(within(builder).getByRole("button", { name: "Review renewal change" })).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("quotes an existing two-bank customer's same-cadence All Access choice as an immediate expansion", async () => {
    const allPreview = { ...preview,
      snapshot: { ...snapshot, allAccess: true, selectedBankIds: [], targetPriceId: "price_all", targetQuantity: 1 },
      target: { ...preview.target, productId: "bundle_all", selectedBankIds: [] },
      estimate: { ...preview.estimate, recurringSubtotalCents: 2500 },
    };
    const fetch = vi.fn().mockResolvedValueOnce(response(allPreview)); vi.stubGlobal("fetch", fetch);
    const twoBanks = { ...plan(), bankSelection: { kind: "selected" as const, banks: [banks[0], banks[1]] }, item: { ...plan().item, quantity: 2 } };
    render(<AccountSubscriptionEditor subscription={twoBanks} bankOptions={banks} onUpdated={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Build Your Plan" }).closest("article")).toHaveAttribute("data-current-plan", "true");
    fireEvent.click(screen.getByRole("button", { name: "Select All Access" }));
    expect(screen.getByRole("heading", { name: "All Access" }).closest("article")!.querySelector(".account-plan-card-price")).toHaveTextContent("$25/ month");
    fireEvent.click(screen.getByRole("button", { name: "Review change" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch.mock.calls[0][0]).toBe("/api/billing/subscription/change/preview");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ selectedBankIds: [], allAccess: true, interval: "monthly" });
  });

  it("requires review of an exact same-cadence expansion quote before confirmation and never claims access is paid", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(preview)).mockResolvedValueOnce(response({ status: "pending" }));
    vi.stubGlobal("fetch", fetch);
    const updated = vi.fn();
    render(<AccountSubscriptionEditor subscription={plan()} bankOptions={banks} onUpdated={updated} />);
    fireEvent.click(screen.getByRole("button", { name: "Select Build Your Plan" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "IGCSE Mathematics" }));
    fireEvent.click(screen.getByRole("button", { name: "Review change" }));
    await screen.findByText(/estimated due today/i);
    expect(screen.getByText(/\$3\.80/)).toBeInTheDocument();
    expect(screen.getByText(/\$10\.00 \/ month/i)).toBeInTheDocument();
    const sentPreview = JSON.parse(fetch.mock.calls[0][1].body);
    expect(fetch.mock.calls[0][0]).toBe("/api/billing/subscription/change/preview");
    expect(sentPreview).toEqual({ selectedBankIds: ["ib-hl", "igcse"], allAccess: false, interval: "monthly" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ ...sentPreview, snapshot });
    expect(await screen.findByText(/payment is pending/i)).toBeInTheDocument();
    expect(screen.queryByText(/access unlocked|payment complete/i)).not.toBeInTheDocument();
    expect(updated).toHaveBeenCalledOnce();
  });
  it("reviews a bank swap for renewal, never sending it to the immediate expansion endpoint", async () => {
    const renewalSnapshot = { subscriptionId: "sub_one", currentPeriodStart: 1790208000, currentPeriodEnd: 1792886400, currentPriceId: "price_one", currentQuantity: 1, currentProductId: "bank_ib_hl", currentSelectedBankIds: ["ib-hl"], currentInterval: "monthly", targetPriceId: "price_one", quantity: 1, recurringSubtotalCents: 600, selectedBankIds: ["igcse"], allAccess: false, interval: "monthly", quotedAt: Math.floor(Date.now() / 1000) };
    const fetch = vi.fn().mockResolvedValueOnce(response({ status: "preview", snapshot: renewalSnapshot, currency: "usd", effectiveAt: "2026-10-25T00:00:00Z" })).mockResolvedValueOnce(response({ status: "scheduled", scheduleId: "sub_sched_1", effectiveAt: "2026-10-25T00:00:00Z" }));
    vi.stubGlobal("fetch", fetch);
    const updated = vi.fn();
    render(<AccountSubscriptionEditor subscription={plan()} bankOptions={banks} onUpdated={updated} />);
    fireEvent.click(screen.getByRole("heading", { name: "One Bank" }).closest("article")!.querySelector("summary")!);
    fireEvent.click(screen.getByRole("radio", { name: "IGCSE Mathematics" }));
    fireEvent.click(screen.getByRole("button", { name: "Review renewal change" }));
    expect(await screen.findByText(/\$6\.00 \/ month/i)).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toBe("/api/billing/subscription/schedule");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ intent: "preview", selectedBankIds: ["igcse"], allAccess: false, interval: "monthly" });
    fireEvent.click(screen.getByRole("button", { name: "Schedule change" }));
    await waitFor(() => expect(updated).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ intent: "create", selectedBankIds: ["igcse"], allAccess: false, interval: "monthly", snapshot: renewalSnapshot });
    expect(screen.getByRole("status")).toHaveTextContent(/after renewal payment is verified/i);
  });
  it("reviews period-end cancellation and offers undo while access is still active", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ status: "canceling", cancelAtPeriodEnd: true, effectiveAt: "2026-10-25T00:00:00Z" })).mockResolvedValueOnce(response({ status: "active", cancelAtPeriodEnd: false, effectiveAt: "2026-10-25T00:00:00Z" }));
    vi.stubGlobal("fetch", fetch);
    const updated = vi.fn();
    const { rerender } = render(<AccountSubscriptionEditor subscription={plan()} bankOptions={banks} onUpdated={updated} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel subscription" }));
    expect(screen.getByText(/oct 25, 2026/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ intent: "cancel" });
    await waitFor(() => expect(updated).toHaveBeenCalledOnce());
    rerender(<AccountSubscriptionEditor subscription={plan(true)} bankOptions={banks} onUpdated={updated} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo cancellation" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ intent: "undo" });
    await waitFor(() => expect(updated).toHaveBeenCalledTimes(2));
  });
  it("requires a new quote after a conflict and does not confirm a stale snapshot", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(preview)).mockResolvedValueOnce(response({ error: "Quote changed; preview again" }, 409));
    vi.stubGlobal("fetch", fetch);
    render(<AccountSubscriptionEditor subscription={plan()} bankOptions={banks} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select Build Your Plan" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "IGCSE Mathematics" }));
    fireEvent.click(screen.getByRole("button", { name: "Review change" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm change" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/preview again/i);
    expect(screen.queryByRole("button", { name: "Confirm change" })).not.toBeInTheDocument();
  });
});
