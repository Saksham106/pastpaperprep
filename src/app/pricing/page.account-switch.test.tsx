import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountIdFromCookieHeader } from "@/lib/supabase/auth-cookie";
import { pricingTestUrl, renderPricingPage, routeAccountRequestsToHandler, setSessionFor, setSignedIn } from "./pricing-page-harness";

const mocks = vi.hoisted(() => ({ fetchAccessEntitlements: vi.fn() }));
// Like Supabase, the server derives the user from the session cookie the request carries.
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: accountIdFromCookieHeader(document.cookie) } } }) } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(pricingTestUrl.search), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

const ACCOUNT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ACCOUNT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
// A holds a complimentary All Access grant; B is a free account.
const COMPLIMENTARY = [{ productId: "bundle_all", status: "active", startsAt: "2025-01-01T00:00:00.000Z", expiresAt: null, source: "manual", products: { name: "All Access" } }];
const rowsFor = (userId: string) => ({ rows: userId === ACCOUNT_A ? COMPLIMENTARY : [], error: null });

beforeEach(() => {
  vi.clearAllMocks();
  routeAccountRequestsToHandler();
  mocks.fetchAccessEntitlements.mockImplementation(async (_client: unknown, userId: string) => rowsFor(userId));
  setSessionFor(ACCOUNT_A);
});
afterEach(() => { setSignedIn(false); vi.unstubAllGlobals(); });

const switchTo = (userId: string, event: "focus" | "ppp:session-change") => {
  setSessionFor(userId); // Replaces A's cookie: this page never sees a signed-out moment.
  act(() => { window.dispatchEvent(new Event(event)); });
};

describe("pricing when another tab switches the account", () => {
  for (const event of ["focus", "ppp:session-change"] as const) {
    it(`drops A's plan and loads B's after a direct switch noticed on ${event}`, async () => {
      renderPricingPage();
      expect(await screen.findByText("Complimentary access")).toBeInTheDocument();

      switchTo(ACCOUNT_B, event);
      expect(screen.queryByText("Complimentary access")).not.toBeInTheDocument();
      expect(await screen.findByText(/^Free$/)).toBeInTheDocument();
      expect(document.querySelector('[aria-label="PastPaperPrep plans"] #plan-builder')).toBeInTheDocument();
      expect(mocks.fetchAccessEntitlements.mock.calls.map(([, userId]) => userId)).toEqual([ACCOUNT_A, ACCOUNT_B]);
    });
  }

  it("discards A's response when it arrives after B became the owner", async () => {
    let releaseA!: () => void;
    mocks.fetchAccessEntitlements.mockImplementationOnce((_client: unknown, userId: string) => new Promise((resolve) => { releaseA = () => resolve(rowsFor(userId)); }));
    renderPricingPage();
    await waitFor(() => expect(mocks.fetchAccessEntitlements).toHaveBeenCalledWith(expect.anything(), ACCOUNT_A));

    switchTo(ACCOUNT_B, "ppp:session-change");
    expect(await screen.findByText(/^Free$/)).toBeInTheDocument();

    await act(async () => { releaseA(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(screen.queryByText("Complimentary access")).not.toBeInTheDocument();
    expect(screen.getByText(/^Free$/)).toBeInTheDocument();
  });

  it("drops a response whose cookie changed before any session event reached the page", async () => {
    let releaseA!: () => void;
    mocks.fetchAccessEntitlements.mockImplementationOnce((_client: unknown, userId: string) => new Promise((resolve) => { releaseA = () => resolve(rowsFor(userId)); }));
    renderPricingPage();
    await waitFor(() => expect(mocks.fetchAccessEntitlements).toHaveBeenCalledWith(expect.anything(), ACCOUNT_A));

    setSessionFor(ACCOUNT_B); // No event dispatched.
    await act(async () => { releaseA(); await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(screen.queryByText("Complimentary access")).not.toBeInTheDocument();
    expect(await screen.findByText(/^Free$/)).toBeInTheDocument();
  });

  it("keeps the plan through a token refresh for the same account", async () => {
    renderPricingPage();
    expect(await screen.findByText("Complimentary access")).toBeInTheDocument();
    setSessionFor(ACCOUNT_A, "refreshed-token"); // Same owner, rewritten cookie.
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(screen.getByText("Complimentary access")).toBeInTheDocument();
    expect(mocks.fetchAccessEntitlements).toHaveBeenCalledTimes(1);
  });
});
