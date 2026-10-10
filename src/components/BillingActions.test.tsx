import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const analytics = vi.hoisted(() => ({ trackProductEvent: vi.fn() }));
vi.mock("@/lib/product-analytics", () => analytics);

import { CheckoutButton, CheckoutButtons, CustomBundleCheckout, LifetimeCheckout, PlanCheckout, PortalButton } from "@/components/BillingActions";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
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
    expect(analytics.trackProductEvent).toHaveBeenCalledWith("checkout_start", {
      interval: "monthly",
      productId: "bank_ib_hl",
      bankCount: 0,
    });
    expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/monthly");
  });

  it("captures only bounded response status and category for checkout failures", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "private detail should not be sent" }) });
    render(<CheckoutButton interval="monthly" productId="bank_ib_hl" />);
    fireEvent.click(screen.getByRole("button", { name: /choose monthly/i }));
    await waitFor(() => expect(analytics.trackProductEvent).toHaveBeenCalledWith("checkout_error", {
      interval: "monthly", productId: "bank_ib_hl", status: 503, errorCategory: "server_error",
    }));
    expect(JSON.stringify(analytics.trackProductEvent.mock.calls)).not.toContain("private detail");
  });

  it("sends selected canonical bank IDs for a custom bundle", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ url: "https://checkout.stripe.com/c/pay/custom" }) });
    const navigate = vi.fn();
    render(<CheckoutButton interval="annual" productId="bundle_custom" selectedBankIds={["igcse", "ib-sl"]} navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /choose annual/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", expect.objectContaining({
      body: JSON.stringify({ interval: "annual", productId: "bundle_custom", selectedBankIds: ["igcse", "ib-sl"] }),
    })));
  });

  it("preserves the exact custom bank selection when sign-in is required", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "Authentication required" }) });
    render(<CheckoutButton interval="annual" productId="bundle_custom" selectedBankIds={["ib-sl", "igcse"]} />);
    fireEvent.click(screen.getByRole("button", { name: /choose annual/i }));
    expect(await screen.findByRole("link", { name: /sign in to continue/i })).toHaveAttribute(
      "href",
      "/login?next=%2Fpricing%3Finterval%3Dannual%26product%3Dbundle_custom%26banks%3Dib-sl%252Cigcse",
    );
  });

  it("takes an eligible subscriber to their existing plan instead of showing a checkout rejection", async () => {
    const navigate = vi.fn();
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "MANAGE_EXISTING_PLAN", manageUrl: "/account/subscription", error: "Use My Account" }) });
    render(<CheckoutButton interval="monthly" productId="bank_ib_hl" navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /choose monthly/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/account/subscription"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never follows an arbitrary destination from a checkout error", async () => {
    const navigate = vi.fn();
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ code: "MANAGE_EXISTING_PLAN", manageUrl: "https://evil.example/", error: "Try My Account" }) });
    render(<CheckoutButton interval="monthly" productId="bank_ib_hl" navigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: /choose monthly/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try My Account");
    expect(navigate).not.toHaveBeenCalled();
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

describe("CustomBundleCheckout", () => {
  it("does not preselect a single bank or offer checkout before the user chooses", () => {
    render(<CustomBundleCheckout mode="single" interval="monthly" authenticated={true} hasPaidAccess={false} />);

    expect(screen.queryAllByRole("radio", { checked: true })).toHaveLength(0);
    expect(screen.getByText("Choose a bank")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pick a bank" })).toBeDisabled();
    expect(screen.queryByText(/to continue/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /choose monthly/i })).not.toBeInTheDocument();
  });

  it("uses the selected bank name in a single-bank checkout action", () => {
    render(<CustomBundleCheckout mode="single" interval="monthly" authenticated={false} hasPaidAccess={false} />);

    fireEvent.click(screen.getByRole("radio", { name: "IB Math AA SL" }));

    expect(screen.getByRole("link", { name: "Unlock IB Math AA SL" })).toBeInTheDocument();
  });

  it("does not preselect builder banks and requires two choices before checkout", () => {
    render(<CustomBundleCheckout mode="builder" interval="monthly" authenticated={true} hasPaidAccess={false} />);
    const checkboxes = screen.getAllByRole("checkbox");

    expect(screen.queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Pick 2+ banks" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();

    fireEvent.click(checkboxes[0]);
    expect(screen.getByRole("button", { name: "Pick 1 more bank" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /continue with/i })).not.toBeInTheDocument();

    fireEvent.click(checkboxes[1]);
    expect(screen.getByRole("button", { name: "Continue to checkout" })).toBeInTheDocument();
  });

  it("maps each gated IGCSE release bank to its single-bank product", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS", "true");
    vi.stubEnv("PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED", "true");
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "stop after request" }) });

    const { unmount } = render(<CustomBundleCheckout mode="single" interval="monthly" authenticated={true} hasPaidAccess={false} initialBankIds={["igcse-biology-0610"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue to checkout" }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/billing/checkout", expect.objectContaining({
      body: JSON.stringify({ interval: "monthly", productId: "bank_igcse_biology_0610" }),
    })));
    unmount();

    fetchMock.mockClear();
    render(<CustomBundleCheckout mode="single" interval="annual" authenticated={true} hasPaidAccess={false} initialBankIds={["igcse-economics-0455"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue to checkout" }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/billing/checkout", expect.objectContaining({
      body: JSON.stringify({ interval: "annual", productId: "bank_igcse_economics_0455" }),
    })));
  });

  it("uses the fixed single-bank product instead of the custom-bundle path", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: "stop after request" }) });
    render(<CustomBundleCheckout mode="single" interval="annual" authenticated={true} hasPaidAccess={false} initialBankIds={["ib-sl"]} />);

    fireEvent.click(screen.getByRole("button", { name: "Unlock IB Math AA SL" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", expect.objectContaining({
      body: JSON.stringify({ interval: "annual", productId: "bank_ib_sl" }),
    })));
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

    fireEvent.click(screen.getByRole("button", { name: /choose access.*IGCSE 0580/i }));
    fireEvent.click(screen.getByRole("option", { name: "IB AI HL" }));
    expect(screen.getByRole("link", { name: /continue to checkout/i })).toHaveAttribute(
      "href",
      "/login?next=%2Fpricing%3Finterval%3Dmonthly%26product%3Dbank_ib_ai_hl",
    );
  });

  it("supports keyboard selection in the designed access picker", () => {
    render(<PlanCheckout authenticated={false} hasPaidAccess={false} interval="annual" options={[{ productId: "bank_igcse", label: "IGCSE 0580" }, { productId: "bank_ib_ai_hl", label: "IB AI HL" }]} />);
    const trigger = screen.getByRole("button", { name: /choose access.*IGCSE 0580/i });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const option = screen.getByRole("option", { name: "IB AI HL" });
    option.focus(); fireEvent.keyDown(option, { key: "Enter" });
    expect(trigger).toHaveTextContent("IB AI HL");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows lifetime conversion only after server eligibility verification", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ state: "conversion_eligible", priceCents: 29900, currency: "usd", creditCents: 0, renewalStopsAfterPayment: true }) });
    render(<LifetimeCheckout authenticated />);
    expect(screen.getByRole("button", { name: /checking billing eligibility/i })).toBeDisabled();
    expect(await screen.findByText(/after this payment is verified, your current subscription renewals stop/i)).toBeInTheDocument();
    expect(screen.getByText(/no automatic credit or refund/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/lifetime/eligibility", expect.objectContaining({ method: "GET", cache: "no-store" }));
  });

  it("fails closed when lifetime eligibility cannot be verified", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "unavailable" }) });
    render(<LifetimeCheckout authenticated />);
    expect(await screen.findByRole("button", { name: /lifetime checkout unavailable/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Unlock lifetime access" })).not.toBeInTheDocument();
  });

  it("offers first-purchase lifetime only for a verified eligible account", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ state: "eligible", priceCents: 29900, currency: "usd", creditCents: 0, renewalStopsAfterPayment: false }) });
    render(<LifetimeCheckout authenticated />);
    expect(await screen.findByRole("button", { name: "Unlock lifetime access" })).toBeEnabled();
    expect(screen.queryByText(/current subscription renewals stop/i)).not.toBeInTheDocument();
  });

  it("does not offer a second lifetime purchase when the server says access is covered", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ state: "covered", reason: "access_covered" }) });
    render(<LifetimeCheckout authenticated />);
    expect(await screen.findByRole("button", { name: /lifetime access is active/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Unlock lifetime access" })).not.toBeInTheDocument();
  });

  it("fails closed for a server-classified complex billing arrangement", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ state: "billing_support", reason: "billing_support" }) });
    render(<LifetimeCheckout authenticated />);
    expect(await screen.findByRole("button", { name: /lifetime checkout unavailable/i })).toBeDisabled();
    expect(screen.getByText(/couldn’t safely verify this billing arrangement/i)).toBeInTheDocument();
  });

  it("keeps lifetime checkout available to anonymous visitors through sign in", () => {
    render(<LifetimeCheckout authenticated={false} />);
    expect(screen.getByRole("link", { name: /unlock lifetime access/i })).toHaveAttribute("href", "/login?next=%2Fpricing%3Fplan%3Dlifetime");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
