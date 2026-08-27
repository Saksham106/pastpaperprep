import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutButton, CheckoutButtons, PlanCheckout, PortalButton } from "@/components/BillingActions";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("CheckoutButtons", () => {
  it("renders a single independently placeable interval action", async () => {
    const navigate = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://checkout.stripe.com/c/pay/monthly" }),
    });

    render(<CheckoutButton interval="monthly" productId="bank_ib_hl" navigate={navigate} />);
    expect(screen.queryByRole("button", { name: /choose annual/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /choose monthly/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_hl" }),
    }));
    expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/monthly");
  });

  it("starts the selected allowlisted billing interval and follows Stripe's URL", async () => {
    const navigate = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://checkout.stripe.com/c/pay/test" }),
    });

    render(<CheckoutButtons productId="bundle_all" navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /choose annual/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval: "annual", productId: "bundle_all" }),
    }));
    expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/test");
  });

  it("disables both interval choices while one checkout request is pending", async () => {
    let resolveFetch!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));

    render(<CheckoutButtons productId="bundle_all" />);
    const annual = screen.getByRole("button", { name: /choose annual/i });
    const monthly = screen.getByRole("button", { name: /choose monthly/i });

    fireEvent.click(annual);

    expect(annual).toBeDisabled();
    expect(monthly).toBeDisabled();
    fireEvent.click(monthly);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch({ ok: false, status: 503, json: async () => ({ error: "Billing is not available yet" }) });
    expect(await screen.findByRole("alert")).toHaveTextContent("Billing is not available yet");
  });

  it("offers sign-in after an unauthenticated checkout request", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "Authentication required" }) });
    render(<CheckoutButtons productId="bundle_all" />);
    fireEvent.click(screen.getByRole("button", { name: /choose monthly/i }));
    expect(await screen.findByRole("link", { name: /sign in to continue/i })).toHaveAttribute(
      "href",
      "/login?next=%2Fpricing%3Finterval%3Dmonthly%26product%3Dbundle_all",
    );
  });

  it("shows a fail-closed message while billing is disabled", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "Billing is not available yet" }) });
    render(<CheckoutButtons productId="bundle_all" />);
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

describe("PlanCheckout", () => {
  it("lets visitors choose a bank before continuing through sign-in", () => {
    render(<PlanCheckout
      authenticated={false}
      hasPaidAccess={false}
      interval="monthly"
      options={[
        { productId: "bank_igcse", label: "IGCSE 0580" },
        { productId: "bank_ib_ai_hl", label: "IB AI HL" },
      ]}
    />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "bank_ib_ai_hl" } });
    expect(screen.getByRole("link", { name: /continue to checkout/i })).toHaveAttribute(
      "href",
      "/login?next=%2Fpricing%3Finterval%3Dmonthly%26product%3Dbank_ib_ai_hl",
    );
  });
});
