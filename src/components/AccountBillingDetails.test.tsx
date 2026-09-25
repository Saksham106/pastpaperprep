import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountBillingDetails } from "@/components/AccountBillingDetails";

afterEach(() => vi.unstubAllGlobals());
const subscription = (id: string, banks: string[], amount: number) => ({
  id, status: "active", cancelAtPeriodEnd: false, cancelAt: null,
  bankSelection: { kind: "selected", banks: banks.map((name) => ({ slug: name.toLowerCase().replaceAll(" ", "-"), name })) },
  items: [{ id: `si_${id}`, quantity: banks.length, recurringSubtotalCents: amount, price: { id: "price_test", currency: "usd", interval: "month", intervalCount: 1 }, currentPeriodEnd: "2026-10-25T00:00:00.000Z" }],
});
const mockFetch = (body: unknown, status = 200) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: status === 200, status, json: async () => body }));

describe("AccountBillingDetails", () => {
  it("shows exact separate plans, prices, banks, and renewal dates without implying consolidation", async () => {
    mockFetch({ subscriptions: [subscription("sub_one", ["Mathematics 0580"], 600), subscription("sub_two", ["IB Math AA HL"], 600)], invoices: [], invoicesHasMore: false, paymentMethod: null, management: { editable: false } });
    render(<AccountBillingDetails mode="subscription" />);
    expect(screen.getByText(/loading subscription details/i)).toBeInTheDocument();
    const plans = await screen.findAllByTestId("subscription-detail");
    expect(plans).toHaveLength(2);
    expect(within(plans[0]).getByText("Mathematics 0580")).toBeInTheDocument();
    expect(within(plans[1]).getByText("IB Math AA HL")).toBeInTheDocument();
    expect(within(plans[0]).getByText(/\$6\.00.*month/i)).toBeInTheDocument();
    expect(screen.getByText(/billed as separate subscriptions/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change plan/i })).not.toBeInTheDocument();
  });
  it("shows the bank editor only for a single eligible subscription when the server enables it", async () => {
    const bank = { slug: "mathematics-0580", name: "Mathematics 0580" };
    mockFetch({ subscriptions: [subscription("sub_one", [bank.name], 600)], invoices: [], paymentMethod: null, bankOptions: [bank, { slug: "ib-sl", name: "IB Math AA SL" }], management: { editable: true } });
    render(<AccountBillingDetails mode="subscription" />);
    expect(await screen.findByRole("button", { name: "Change plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel subscription" })).toBeInTheDocument();
  });
  it("shows no editor actions when management is not editable", async () => {
    mockFetch({ subscriptions: [subscription("sub_one", ["Mathematics 0580"], 600)], invoices: [], paymentMethod: null, bankOptions: [{ slug: "math", name: "Math" }], management: { editable: false } });
    render(<AccountBillingDetails mode="subscription" />);
    await screen.findByTestId("subscription-detail");
    expect(screen.queryByRole("button", { name: /change plan|cancel subscription|undo cancellation/i })).not.toBeInTheDocument();
  });
  it("explains pending payment without claiming that new banks are unlocked", async () => {
    mockFetch({ subscriptions: [{ ...subscription("sub_one", ["Mathematics 0580"], 600), pendingUpdate: true }], invoices: [], paymentMethod: null, management: { editable: false } });
    render(<AccountBillingDetails mode="subscription" />);
    expect(await screen.findByText(/awaiting payment/i)).toBeInTheDocument();
    expect(screen.getByText(/current bank access remains in place/i)).toBeInTheDocument();
  });
  it("retains the paid-access end date after cancellation and never says access ended immediately", async () => {
    mockFetch({ subscriptions: [{ ...subscription("sub_one", ["Mathematics 0580"], 600), cancelAtPeriodEnd: true }], invoices: [], paymentMethod: null, management: { editable: false } });
    render(<AccountBillingDetails mode="subscription" />);
    expect(await screen.findByText(/access through oct 25, 2026/i)).toBeInTheDocument();
  });
  it("treats a missing Stripe customer as no paid billing account, not an unknown $0 plan", async () => {
    mockFetch({ error: "No billing account found" }, 404);
    render(<AccountBillingDetails mode="subscription" />);
    expect(await screen.findByText(/no stripe subscription/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$0/)).not.toBeInTheDocument();
  });
  it("does not misformat non-USD Stripe minor units as US-style cents", async () => {
    mockFetch({ subscriptions: [{ ...subscription("sub_one", ["Mathematics 0580"], 600), items: [{ ...subscription("sub_one", ["Mathematics 0580"], 600).items[0], price: { currency: "jpy", interval: "month", intervalCount: 1 } }] }], invoices: [], paymentMethod: null, management: { editable: false } });
    render(<AccountBillingDetails mode="subscription" />);
    expect(await screen.findByText(/plan price unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/¥/)).not.toBeInTheDocument();
  });
  it("marks the invoice list as partial and sends the rest to the portal", async () => {
    mockFetch({ subscriptions: [], invoices: [{ id: "in_1", status: "paid", amountPaid: 600, amountDue: 0, currency: "usd", created: "2026-09-01T00:00:00Z" }], invoicesHasMore: true, paymentMethod: null, management: { editable: false } });
    render(<AccountBillingDetails mode="billing" />);
    expect(await screen.findByText(/more invoices are available in the secure billing portal/i)).toBeInTheDocument();
  });
  it("does not present a past canceled subscription as a current plan", async () => {
    mockFetch({ subscriptions: [{ ...subscription("sub_old", ["Mathematics 0580"], 600), status: "canceled" }], invoices: [], paymentMethod: null, management: { editable: false } });
    render(<AccountBillingDetails mode="subscription" />);
    expect(await screen.findByText(/no current paid subscriptions/i)).toBeInTheDocument();
    expect(screen.queryByTestId("subscription-detail")).not.toBeInTheDocument();
  });
  it("links an open invoice to Stripe's hosted payment page without handling card details", async () => {
    mockFetch({ subscriptions: [], invoices: [{ id: "in_open", status: "open", amountPaid: 0, amountDue: 500, currency: "usd", created: "2026-09-25T00:00:00Z", hostedInvoiceUrl: "https://invoice.stripe.com/i/acct_test/example" }], paymentMethod: null, management: { editable: false } });
    render(<AccountBillingDetails mode="billing" />);
    expect(await screen.findByRole("link", { name: "Pay invoice in Stripe" })).toHaveAttribute("href", "https://invoice.stripe.com/i/acct_test/example");
  });
  it("does not link an untrusted invoice URL", async () => {
    mockFetch({ subscriptions: [], invoices: [{ id: "in_open", status: "open", amountPaid: 0, amountDue: 500, currency: "usd", created: "2026-09-25T00:00:00Z", hostedInvoiceUrl: "https://invoice.stripe.com.evil.example/phish" }], paymentMethod: null, management: { editable: false } });
    render(<AccountBillingDetails mode="billing" />);
    await screen.findByText(/\$5\.00 due/i);
    expect(screen.queryByRole("link", { name: "Pay invoice in Stripe" })).not.toBeInTheDocument();
  });
  it("shows amount due rather than amount paid for an open invoice", async () => {
    mockFetch({ subscriptions: [], invoices: [{ id: "in_unpaid", status: "open", amountPaid: 0, amountDue: 1000, currency: "usd", created: "2026-09-25T00:00:00.000Z" }], paymentMethod: null, management: { editable: false } });
    render(<AccountBillingDetails mode="billing" />);
    expect(await screen.findByText(/open.*\$10\.00 due/i)).toBeInTheDocument();
    expect(screen.queryByText(/open.*\$0\.00/i)).not.toBeInTheDocument();
  });
  it("shows only verified invoice and payment-method details in Billing", async () => {
    mockFetch({ subscriptions: [], invoices: [{ id: "in_one", status: "paid", amountPaid: 1000, amountDue: 0, currency: "usd", created: "2026-09-25T00:00:00.000Z" }], paymentMethod: { type: "card", cardBrand: "visa", last4: "4242", cardExpiryMonth: 12, cardExpiryYear: 2027 }, management: { editable: false } });
    render(<AccountBillingDetails mode="billing" />);
    expect(await screen.findByText(/visa ending in 4242/i)).toBeInTheDocument();
    expect(screen.getByText(/paid.*\$10\.00/i)).toBeInTheDocument();
  });
});
