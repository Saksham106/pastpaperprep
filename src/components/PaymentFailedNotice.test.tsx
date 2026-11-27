import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackProductEvent = vi.fn();
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: (...args: unknown[]) => trackProductEvent(...args) }));
import { PaymentFailedNotice, noticeCopy } from "@/components/PaymentFailedNotice";
import type { PaymentFailedNotice as Notice } from "@/lib/payment-failed-notice";

const grace: Notice = {
  invoiceId: "in_1", amountCents: 1000, currency: "usd", accessEndsAt: "2026-12-10T12:00:00.000Z", accessEnded: false,
  nextRetryAt: "2026-11-28T12:00:00.000Z", payUrl: "https://invoice.stripe.com/i/acct_1/x",
};
const fetchMock = vi.fn();

function respond(notice: Notice | null) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ notice }), { status: 200 }));
}
const ACCOUNT_A = "11111111-1111-4111-8111-111111111111";
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222";
function signIn(id = ACCOUNT_A) { document.cookie = `sb-project-auth-token=${encodeURIComponent(JSON.stringify({ user: { id } }))}; path=/`; }
// jsdom can't follow links; stop the default so clicks only exercise our handlers.
function blockNavigation(event: MouseEvent) { if ((event.target as Element | null)?.closest("a")) event.preventDefault(); }
function signOut() { document.cookie = "sb-project-auth-token=; Max-Age=0; path=/"; }

describe("PaymentFailedNotice", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    trackProductEvent.mockReset();
    localStorage.clear();
    sessionStorage.clear();
    signIn();
    document.addEventListener("click", blockNavigation);
  });
  afterEach(() => { signOut(); document.removeEventListener("click", blockNavigation); vi.unstubAllGlobals(); });

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

  it("explains lost access and the checkout block on pricing", () => {
    const ended = { ...grace, accessEnded: true, accessEndsAt: null };
    expect(noticeCopy(ended, "bank")).toBe("Your latest renewal payment of $10.00 didn't go through, so your access has stopped. Pay now to restore it.");
    expect(noticeCopy(grace, "pricing")).toBe("Your latest renewal payment of $10.00 didn't go through. Pay by Dec 10 to keep access. New plans unlock once it's paid.");
    expect(noticeCopy({ ...grace, accessEndsAt: null }, "account")).toBe("Your latest renewal payment of $10.00 didn't go through. Pay now to keep access.");
  });

  it("falls back to the billing portal and only follows Stripe's portal host", async () => {
    const navigate = vi.fn();
    respond({ ...grace, payUrl: null });
    render(<PaymentFailedNotice placement="bank" navigate={navigate} />);
    const button = await screen.findByRole("button", { name: "Update payment method" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://evil.example/session" }), { status: 200 }));
    fireEvent.click(button);
    expect(await screen.findByText(/billing portal didn't open/)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ url: "https://billing.stripe.com/p/session/x" }), { status: 200 }));
    fireEvent.click(button);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://billing.stripe.com/p/session/x"));
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/portal", { method: "POST" });
    expect(trackProductEvent).toHaveBeenCalledWith("payment_failed_notice_click", { placement: "bank", state: "grace", action: "portal" });
  });

  it("hides for the rest of the day once dismissed", async () => {
    respond(grace);
    const first = render(<PaymentFailedNotice placement="dashboard" />);
    fireEvent.click(await screen.findByRole("button", { name: "Hide for today" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    first.unmount();
    fetchMock.mockClear();
    render(<PaymentFailedNotice placement="dashboard" />);
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("remembers a clear answer for this account so other pages skip the request", async () => {
    respond(null);
    const first = render(<PaymentFailedNotice placement="bank" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    first.unmount();
    render(<PaymentFailedNotice placement="dashboard" />);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // A different account in the same tab asks again.
    signIn(ACCOUNT_B);
    render(<PaymentFailedNotice placement="dashboard" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("stays silent when the check fails", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    const { container } = render(<PaymentFailedNotice placement="bank" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(trackProductEvent).not.toHaveBeenCalled();
  });
});
