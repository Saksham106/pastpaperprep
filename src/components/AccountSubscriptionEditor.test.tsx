import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountSubscriptionEditor } from "@/components/AccountSubscriptionEditor";

afterEach(() => vi.unstubAllGlobals());
const banks = [{ slug: "ib-hl", name: "IB Math AA HL" }, { slug: "igcse", name: "IGCSE Mathematics" }, { slug: "ib-sl", name: "IB Math AA SL" }];
const plan = (cancelAtPeriodEnd = false) => ({ id: "sub_one", cancelAtPeriodEnd, bankSelection: { kind: "selected" as const, banks: [banks[0]] }, item: { currentPeriodEnd: "2026-10-25T00:00:00Z", price: { interval: "month" } } });
const snapshot = { prorationDate: Math.floor(Date.now() / 1000), amountDueTodayCents: 380, estimatedCreditCents: 200, estimatedTaxesCents: 0, currency: "usd", currentSubscriptionId: "sub_one", currentItemId: "si_one", currentPriceId: "price_one", currentQuantity: 1, periodEnd: 1792886400, targetPriceId: "price_two", targetQuantity: 2, selectedBankIds: ["ib-hl", "igcse"], allAccess: false, interval: "monthly" };
const preview = { estimate: { amountDueTodayCents: 380, estimatedCreditCents: 200, estimatedTaxesCents: 0, recurringSubtotalCents: 1000, currency: "usd", isEstimate: true }, target: { productId: "bundle_custom", selectedBankIds: ["ib-hl", "igcse"], interval: "monthly", renewalAt: "2026-10-25T00:00:00Z" }, snapshot };
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body });

describe("account subscription editor", () => {
  it("requires review of an exact same-cadence expansion quote before confirmation and never claims access is paid", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response(preview)).mockResolvedValueOnce(response({ status: "pending" }));
    vi.stubGlobal("fetch", fetch);
    const updated = vi.fn();
    render(<AccountSubscriptionEditor subscription={plan()} bankOptions={banks} onUpdated={updated} />);
    fireEvent.click(screen.getByRole("button", { name: "Change plan" }));
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
  it("does not send a removal or swap to the immediate expansion endpoint", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    render(<AccountSubscriptionEditor subscription={plan()} bankOptions={banks} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Change plan" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "IB Math AA HL" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "IGCSE Mathematics" }));
    expect(screen.getByText(/renewal-date changes are not available yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review change" })).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "Change plan" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "IGCSE Mathematics" }));
    fireEvent.click(screen.getByRole("button", { name: "Review change" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm change" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/preview again/i);
    expect(screen.queryByRole("button", { name: "Confirm change" })).not.toBeInTheDocument();
  });
});
