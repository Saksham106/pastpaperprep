import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pricingTestUrl, renderPricingPage, routeAccountRequestsToHandler, setSignedIn } from "./pricing-page-harness";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), fetchAccessEntitlements: vi.fn(), captureServerException: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.getClaims } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
vi.mock("@/lib/server-error-tracking", () => ({ captureServerException: mocks.captureServerException }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(pricingTestUrl.search), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

beforeEach(() => {
  setSignedIn(true);
  routeAccountRequestsToHandler();
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "owner" } } });
  mocks.fetchAccessEntitlements.mockReset();
});
afterEach(() => { setSignedIn(false); vi.unstubAllGlobals(); });

function expectNoCheckout() {
  expect(screen.queryByRole("button", { name: /choose one bank|build your plan|unlock all banks|continue with/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Billing period" })).not.toBeInTheDocument();
}

describe("pricing when Supabase temporarily rejects a fresh session", () => {
  it("shows a retry-only screen rather than offering checkout after the future-JWT error", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: { code: "PGRST303", message: "JWT issued at future" } });
    renderPricingPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't check your access.");
    expect(screen.getByText("Access check delayed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expectNoCheckout();
  });

  it("retries the access check and shows the verified plan once it succeeds", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValueOnce({ rows: [], error: { code: "PGRST303", message: "JWT issued at future" } })
      .mockResolvedValueOnce({ rows: [], error: null });
    renderPricingPage();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: /your current access/i })).toBeInTheDocument();
    expect(screen.getByText(/^Free$/)).toBeInTheDocument();
  });

  it("fails closed on unrelated access errors too, without the clock-bug label", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: { code: "42501", message: "permission denied" } });
    renderPricingPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't check your access.");
    expect(screen.getByText("Access check failed")).toBeInTheDocument();
    expectNoCheckout();
  });

  it("shows nothing purchasable while a signed-in visitor's plan is loading", async () => {
    let release!: () => void;
    mocks.fetchAccessEntitlements.mockReturnValue(new Promise((resolve) => { release = () => resolve({ rows: [], error: null }); }));
    const { container } = renderPricingPage();
    expect(container.querySelector(".pricing-account-pending")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invest in your future." })).toBeInTheDocument();
    expectNoCheckout();
    await waitFor(() => expect(mocks.fetchAccessEntitlements).toHaveBeenCalled());
    release();
    expect(await screen.findByRole("group", { name: "Billing period" })).toBeInTheDocument();
  });
});
