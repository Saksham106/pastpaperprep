import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutButtons, PortalButton } from "@/components/BillingActions";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("CheckoutButtons", () => {
  it("starts the selected allowlisted billing interval and follows Stripe's URL", async () => {
    const navigate = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://checkout.stripe.com/c/pay/test" }),
    });

    render(<CheckoutButtons navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /choose annual/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval: "annual" }),
    }));
    expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/test");
  });

  it("offers sign-in after an unauthenticated checkout request", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "Authentication required" }) });
    render(<CheckoutButtons />);
    fireEvent.click(screen.getByRole("button", { name: /choose monthly/i }));
    expect(await screen.findByRole("link", { name: /sign in to continue/i })).toHaveAttribute("href", "/login?next=/pricing");
  });

  it("shows a fail-closed message while billing is disabled", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "Billing is not available yet" }) });
    render(<CheckoutButtons />);
    fireEvent.click(screen.getByRole("button", { name: /choose annual/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Billing is not available yet");
  });
});

describe("PortalButton", () => {
  it("opens the Stripe customer portal returned by the server", async () => {
    const navigate = vi.fn();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ url: "https://billing.stripe.com/p/session/test" }) });
    render(<PortalButton navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /manage billing/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://billing.stripe.com/p/session/test"));
  });
});
