import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnnualSaleSwitch } from "@/components/AnnualSaleSwitch";

const estimate = { amountDueTodayCents: 3000, creditCents: 600, taxesCents: 0, firstYearCents: 3600, renewsAtCents: 4800, percentOff: 25, currency: "usd" };
const snapshot = { prorationDate: 1, subscriptionId: "sub_1" };
const reply = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("AnnualSaleSwitch", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-28T12:00:00Z"));
    document.documentElement.setAttribute("data-annual-sale", "live");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-annual-sale");
  });

  it("renders nothing outside the sale", () => {
    document.documentElement.removeAttribute("data-annual-sale");
    const { container } = render(<AnnualSaleSwitch onUpdated={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the real charge after a preview, then switches on confirm", async () => {
    const onUpdated = vi.fn();
    fetchMock.mockImplementationOnce(() => reply({ estimate, snapshot })).mockImplementationOnce(() => reply({ status: "processing" }));
    render(<AnnualSaleSwitch onUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: "See my price" }));
    expect(await screen.findByText(/\$30 today/)).toBeInTheDocument();
    expect(screen.getByText("$36 for the year, minus $6 for the rest of this month. Then $48/yr.")).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ intent: "preview" });

    fireEvent.click(screen.getByRole("button", { name: "Pay $30 and switch" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith("You’re on annual now: $30 charged today. It renews at $48/yr."));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ intent: "confirm", snapshot });
  });

  it("keeps the plan monthly and links to Stripe's invoice page when payment is pending", async () => {
    const onUpdated = vi.fn();
    fetchMock.mockImplementationOnce(() => reply({ estimate, snapshot })).mockImplementationOnce(() => reply({ status: "pending", payUrl: "https://invoice.stripe.com/i/acct/test" }));
    render(<AnnualSaleSwitch onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole("button", { name: "See my price" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pay $30 and switch" }));
    expect(await screen.findByRole("status")).toHaveTextContent("still monthly");
    expect(screen.getByRole("link", { name: "Finish payment" })).toHaveAttribute("href", "https://invoice.stripe.com/i/acct/test");
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it("ignores a pay link that is not Stripe's invoice page", async () => {
    fetchMock.mockImplementationOnce(() => reply({ estimate, snapshot })).mockImplementationOnce(() => reply({ status: "pending", payUrl: "https://evil.example/pay" }));
    render(<AnnualSaleSwitch onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "See my price" }));
    fireEvent.click(await screen.findByRole("button", { name: "Pay $30 and switch" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Check Billing to finish paying.");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows account credit in the breakdown", async () => {
    fetchMock.mockImplementationOnce(() => reply({ estimate: { ...estimate, amountDueTodayCents: 2000, accountCreditCents: 1000 }, snapshot }));
    render(<AnnualSaleSwitch onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "See my price" }));
    expect(await screen.findByText("$36 for the year, minus $6 for the rest of this month, minus $10 account credit. Then $48/yr.")).toBeInTheDocument();
  });

  it("shows a clear message when the sale price is unavailable", async () => {
    fetchMock.mockImplementationOnce(() => reply({ code: "SALE_UNAVAILABLE", error: "x" }, 503));
    render(<AnnualSaleSwitch onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "See my price" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The sale price isn’t available right now");
  });
});
