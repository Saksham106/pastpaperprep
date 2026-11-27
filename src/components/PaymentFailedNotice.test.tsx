import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackProductEvent = vi.fn();
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: (...args: unknown[]) => trackProductEvent(...args) }));
type AuthListener = (event: string, session: { user?: { id?: string } } | null) => void;
const authListeners = new Set<AuthListener>();
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { onAuthStateChange: (listener: AuthListener) => { authListeners.add(listener); return { data: { subscription: { unsubscribe: () => authListeners.delete(listener) } } }; } } }),
}));
import { PayFailedRenewalButton, PaymentFailedNotice, noticeCopy } from "@/components/PaymentFailedNotice";
import type { PaymentFailedNotice as Notice } from "@/lib/payment-failed-notice";

const grace: Notice = {
  invoiceId: "in_1", amountCents: 1000, currency: "usd", accessEndsAt: "2026-12-10T12:00:00.000Z", accessEnded: false,
  nextRetryAt: "2026-11-28T12:00:00.000Z", payUrl: "https://invoice.stripe.com/i/acct_1/x",
};
const fetchMock = vi.fn();
const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
const ACCOUNT_C = "33333333-3333-4333-8333-333333333333";

function body(notice: Notice | null, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ notice, purchaseBlocked: notice !== null, ...extra }), { status: 200 });
}
function respond(notice: Notice | null, extra: Record<string, unknown> = {}) {
  fetchMock.mockImplementation(async () => body(notice, extra));
}
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}
function signIn(id = ACCOUNT_A) { document.cookie = `sb-project-auth-token=${encodeURIComponent(JSON.stringify({ user: { id } }))}; path=/`; }
function signOut() { document.cookie = "sb-project-auth-token=; Max-Age=0; path=/"; }
function authEvent(id: string | null) { for (const listener of [...authListeners]) listener(id ? "SIGNED_IN" : "SIGNED_OUT", id ? { user: { id } } : null); }
// jsdom can't follow links; stop the default so clicks only exercise our handlers.
function blockNavigation(event: MouseEvent) { if ((event.target as Element | null)?.closest("a")) event.preventDefault(); }

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  trackProductEvent.mockReset();
  authListeners.clear();
  localStorage.clear();
  sessionStorage.clear();
  signIn();
  document.addEventListener("click", blockNavigation);
});
afterEach(() => { signOut(); document.removeEventListener("click", blockNavigation); vi.unstubAllGlobals(); });

describe("PaymentFailedNotice", () => {
  it("never asks the server for signed-out visitors", async () => {
    signOut();
    const { container } = render(<PaymentFailedNotice placement="bank" />);
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the amount, the access date and a Pay now link to Stripe's invoice", async () => {
    respond(grace);
    render(<PaymentFailedNotice placement="dashboard" />);
    expect(await screen.findByRole("status")).toHaveTextContent("Your latest renewal payment of $10.00 didn't go through. Pay by Dec 10 to keep access.");
    const pay = screen.getByRole("link", { name: "Pay now" });
    expect(pay).toHaveAttribute("href", grace.payUrl);
    expect(pay).toHaveAttribute("target", "_blank");
    expect(pay).toHaveAttribute("rel", "noopener noreferrer");
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/payment-notice", { cache: "no-store" });
    expect(trackProductEvent).toHaveBeenCalledWith("payment_failed_notice_view", { placement: "dashboard", state: "grace", action: "pay" });
    fireEvent.click(pay);
    expect(trackProductEvent).toHaveBeenCalledWith("payment_failed_notice_click", { placement: "dashboard", state: "grace", action: "pay" });
  });

  it("re-checks when the student comes back from paying, and clears the notice", async () => {
    respond(grace);
    render(<PaymentFailedNotice placement="account" />);
    fireEvent.click(await screen.findByRole("link", { name: "Pay now" }));
    respond(null);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("explains lost access, makes no access promise without a date, and on pricing ties paying to changing plan", () => {
    const ended = { ...grace, accessEnded: true, accessEndsAt: null };
    const undated = { ...grace, accessEndsAt: null };
    expect(noticeCopy(ended, "bank")).toBe("Your latest renewal payment of $10.00 didn't go through, so your access has stopped. Pay now to restore it.");
    expect(noticeCopy(undated, "account")).toBe("Your latest renewal payment of $10.00 didn't go through. Pay now to keep your plan.");
    expect(noticeCopy(grace, "pricing")).toBe("Your latest renewal payment of $10.00 didn't go through. Pay by Dec 10 to keep access and change your plan.");
    expect(noticeCopy(ended, "pricing")).toBe("Your latest renewal payment of $10.00 didn't go through, so your access has stopped. Pay now to restore it and change your plan.");
    expect(noticeCopy(undated, "pricing")).toBe("Your latest renewal payment of $10.00 didn't go through. Pay now to keep your plan or change it.");
  });

  it("falls back to the billing portal and only follows Stripe's portal host", async () => {
    const navigate = vi.fn();
    respond({ ...grace, payUrl: null });
    render(<PaymentFailedNotice placement="bank" navigate={navigate} />);
    const button = await screen.findByRole("button", { name: "Update payment method" });
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ url: "https://evil.example/session" }), { status: 200 }));
    fireEvent.click(button);
    expect(await screen.findByText(/billing portal didn't open/)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ url: "https://billing.stripe.com/p/session/x" }), { status: 200 }));
    fireEvent.click(button);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://billing.stripe.com/p/session/x"));
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/portal", { method: "POST" });
    expect(trackProductEvent).toHaveBeenCalledWith("payment_failed_notice_click", { placement: "bank", state: "grace", action: "portal" });
  });

  it("hides one account's one bill for the rest of the day", async () => {
    respond(grace);
    const first = render(<PaymentFailedNotice placement="dashboard" />);
    fireEvent.click(await screen.findByRole("button", { name: "Hide for today" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    first.unmount();

    const again = render(<PaymentFailedNotice placement="dashboard" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    again.unmount();

    // A newer bill, or another account on this browser, still shows.
    respond({ ...grace, invoiceId: "in_2" });
    const newer = render(<PaymentFailedNotice placement="dashboard" />);
    expect(await screen.findByRole("status")).toBeInTheDocument();
    newer.unmount();
    respond(grace);
    signIn(ACCOUNT_B);
    render(<PaymentFailedNotice placement="dashboard" />);
    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("remembers a clear answer for this account so other pages skip the request", async () => {
    respond(null);
    const first = render(<PaymentFailedNotice placement="bank" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    first.unmount();
    const second = render(<PaymentFailedNotice placement="dashboard" />);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    second.unmount();
    signIn(ACCOUNT_B);
    render(<PaymentFailedNotice placement="dashboard" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("drops an answer that arrives after the account changed", async () => {
    const slow = deferred();
    fetchMock.mockImplementationOnce(() => slow.promise);
    render(<PaymentFailedNotice placement="dashboard" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    signIn(ACCOUNT_B);
    respond(null);
    await act(async () => { authEvent(ACCOUNT_B); });
    await act(async () => { slow.resolve(body(grace)); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pay now" })).not.toBeInTheDocument();
  });

  it("clears a shown notice when another account signs in or the student signs out", async () => {
    respond(grace);
    render(<PaymentFailedNotice placement="dashboard" />);
    expect(await screen.findByRole("status")).toBeInTheDocument();
    signIn(ACCOUNT_B);
    respond(null);
    await act(async () => { authEvent(ACCOUNT_B); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    signIn(ACCOUNT_C);
    respond(grace);
    await act(async () => { authEvent(ACCOUNT_C); });
    expect(await screen.findByRole("status")).toBeInTheDocument();
    signOut();
    await act(async () => { authEvent(null); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("notices a sign-in from another tab when the student returns", async () => {
    respond(grace);
    render(<PaymentFailedNotice placement="dashboard" />);
    expect(await screen.findByRole("status")).toBeInTheDocument();
    signIn(ACCOUNT_B);
    respond(null);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("lets only the latest re-check decide", async () => {
    respond(grace);
    render(<PaymentFailedNotice placement="account" />);
    fireEvent.click(await screen.findByRole("link", { name: "Pay now" }));
    const slow = deferred();
    fetchMock.mockImplementationOnce(() => slow.promise);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    respond(null);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    await act(async () => { slow.resolve(body(grace)); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays silent when the check fails", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 503 }));
    const { container } = render(<PaymentFailedNotice placement="bank" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(trackProductEvent).not.toHaveBeenCalled();
  });
});

describe("PaymentFailedNotice: plan ending", () => {
  const ending = { endsAt: "2026-12-01T09:00:00.000Z", interval: "monthly" };

  it("shows the end date and a Keep my plan link where students study", async () => {
    respond(null, { ending });
    render(<PaymentFailedNotice placement="bank" />);
    const strip = await screen.findByRole("status");
    expect(strip).toHaveAttribute("data-state", "ending");
    expect(strip).toHaveTextContent(/Your plan ends on Dec 1 and won't renew\./);
    const keep = screen.getByRole("link", { name: "Keep my plan" });
    expect(keep).toHaveAttribute("href", "/subscription/cancel?from=notice");
    expect(trackProductEvent).toHaveBeenCalledWith("access_ending_notice_view", { placement: "bank", interval: "monthly" });
    fireEvent.click(keep);
    expect(trackProductEvent).toHaveBeenCalledWith("access_ending_notice_click", { placement: "bank", interval: "monthly" });
  });

  it("isn't shown on pricing, and an unpaid bill always wins", async () => {
    respond(null, { ending });
    const pricing = render(<PaymentFailedNotice placement="pricing" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    pricing.unmount();
    respond(grace, { ending });
    render(<PaymentFailedNotice placement="dashboard" />);
    expect(await screen.findByRole("status")).not.toHaveAttribute("data-state", "ending");
  });

  it("hides for the rest of the day; once hidden, other pages skip the request", async () => {
    respond(null, { ending });
    const first = render(<PaymentFailedNotice placement="dashboard" />);
    fireEvent.click(await screen.findByRole("button", { name: "Hide for today" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    first.unmount();
    const second = render(<PaymentFailedNotice placement="dashboard" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    second.unmount();
    render(<PaymentFailedNotice placement="bank" />);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a malformed ending", async () => {
    respond(null, { ending: { endsAt: "soon", interval: "weekly" } });
    render(<PaymentFailedNotice placement="dashboard" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("PayFailedRenewalButton (checkout step)", () => {
  it("says payment was received only when the server confirms that invoice is paid and nothing else blocks", async () => {
    const onResolved = vi.fn();
    respond(grace);
    render(<PayFailedRenewalButton onResolved={onResolved} />);
    const pay = await screen.findByRole("link", { name: "Pay now" });
    expect(trackProductEvent).toHaveBeenCalledWith("payment_failed_notice_view", { placement: "checkout", state: "grace", action: "pay" });
    fireEvent.click(pay);
    expect(trackProductEvent).toHaveBeenCalledWith("payment_failed_notice_click", { placement: "checkout", state: "grace", action: "pay" });
    respond(null, { purchaseBlocked: false, invoicePaid: true });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(await screen.findByRole("status")).toHaveTextContent("Payment received. You can continue now.");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/billing/payment-notice?invoice=in_1", { cache: "no-store" });
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("never treats a missing notice as payment", async () => {
    const onResolved = vi.fn();
    respond(grace);
    render(<PayFailedRenewalButton onResolved={onResolved} />);
    fireEvent.click(await screen.findByRole("link", { name: "Pay now" }));
    // Voided or otherwise not paid, and checkout would still refuse: keep the step.
    respond(null, { purchaseBlocked: true, invoicePaid: false });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(screen.queryByText(/Payment received/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay now" })).toHaveAttribute("href", grace.payUrl);
    expect(onResolved).not.toHaveBeenCalled();

    // Not proven paid, even though nothing blocks checkout any more: still no success and no eligibility refresh.
    respond(null, { purchaseBlocked: false, invoicePaid: false });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay now" })).toBeInTheDocument();
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("two failed bills: paying the first then closing the second unpaid shows no success", async () => {
    const onResolved = vi.fn();
    const second: Notice = { ...grace, invoiceId: "in_2", payUrl: "https://invoice.stripe.com/i/acct_1/second" };
    let paidInvoices = new Set<string>();
    fetchMock.mockImplementation(async (url: string) => {
      const asked = new URL(url, "https://pastpaperprep.com").searchParams.get("invoice");
      const outstanding = [grace, second].filter((bill) => !paidInvoices.has(bill.invoiceId));
      return body(outstanding[0] ?? null, { purchaseBlocked: outstanding.length > 0, invoicePaid: asked ? paidInvoices.has(asked) : false });
    });
    render(<PayFailedRenewalButton onResolved={onResolved} />);

    fireEvent.click(await screen.findByRole("link", { name: "Pay now" }));
    paidInvoices = new Set(["in_1"]);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    const next = await screen.findByRole("link", { name: "Pay now" });
    expect(next).toHaveAttribute("href", second.payUrl);
    expect(screen.queryByText(/Payment received/)).not.toBeInTheDocument();

    // Opens the second bill, closes it unpaid. The check must ask about in_2, not reuse in_1's proof.
    fireEvent.click(next);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/billing/payment-notice?invoice=in_2", { cache: "no-store" });
    expect(screen.queryByText(/Payment received/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay now" })).toHaveAttribute("href", second.payUrl);
    expect(onResolved).not.toHaveBeenCalled();

    // Pays it: now, and only now, success.
    paidInvoices = new Set(["in_1", "in_2"]);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(await screen.findByRole("status")).toHaveTextContent("Payment received. You can continue now.");
    expect(onResolved).toHaveBeenCalledTimes(1);
  });

  it("ignores a proof still in flight for an earlier bill once a newer bill is clicked", async () => {
    const second: Notice = { ...grace, invoiceId: "in_2", payUrl: "https://invoice.stripe.com/i/acct_1/second" };
    respond(grace);
    render(<PayFailedRenewalButton />);
    fireEvent.click(await screen.findByRole("link", { name: "Pay now" }));
    const slow = deferred();
    fetchMock.mockImplementationOnce(() => slow.promise);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    respond(second, { invoicePaid: true });
    // The page showed the second bill meanwhile (another tab); simulate by a fresh check then a click.
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    fireEvent.click(await screen.findByRole("link", { name: "Pay now" }));
    await act(async () => { slow.resolve(body(null, { purchaseBlocked: false, invoicePaid: true })); });
    expect(screen.queryByText(/Payment received/)).not.toBeInTheDocument();
  });

  it("moves to the next blocker once the first bill is paid", async () => {
    respond(grace);
    render(<PayFailedRenewalButton />);
    fireEvent.click(await screen.findByRole("link", { name: "Pay now" }));
    respond(null, { purchaseBlocked: true, invoicePaid: true });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(await screen.findByRole("button", { name: "Update payment method" })).toBeEnabled();
    expect(screen.queryByText(/Payment received/)).not.toBeInTheDocument();
  });

  it("keeps the verified link when a re-check fails", async () => {
    respond(grace);
    render(<PayFailedRenewalButton />);
    fireEvent.click(await screen.findByRole("link", { name: "Pay now" }));
    fetchMock.mockImplementation(async () => new Response("{}", { status: 503 }));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(screen.getByRole("link", { name: "Pay now" })).toHaveAttribute("href", grace.payUrl);
  });

  it("offers the billing portal when the first check fails or finds no invoice", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 503 }));
    render(<PayFailedRenewalButton />);
    expect(await screen.findByRole("button", { name: "Update payment method" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("starts over for a different account and never sends the old invoice id", async () => {
    respond(grace);
    render(<PayFailedRenewalButton />);
    fireEvent.click(await screen.findByRole("link", { name: "Pay now" }));
    signIn(ACCOUNT_B);
    respond(null, { purchaseBlocked: true });
    await act(async () => { authEvent(ACCOUNT_B); });
    expect(await screen.findByRole("button", { name: "Update payment method" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Pay now" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/billing/payment-notice", { cache: "no-store" });
  });
});
