import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), rpc: vi.fn(), getClaims: vi.fn(), capture: vi.fn() }));
vi.mock("@/lib/server-error-tracking", () => ({ captureServerException: mocks.capture }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getClaims: mocks.getClaims, getUser: async () => ({ data: { user: { email: "student@example.com" } } }) },
  from: () => ({ select: () => ({ eq: mocks.query }) }), rpc: mocks.rpc,
}) }));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/DashboardContent", () => ({ DashboardContent: () => <div>Normal dashboard</div> }));
vi.mock("@/components/AccountBillingHub", () => ({ AccountBillingHub: () => <div>Normal billing</div> }));
vi.mock("@/components/PaperBuilder", () => ({ PaperBuilder: () => <div>Normal builder</div> }));
import DashboardPage from "@/app/dashboard/page";
import AccountPage from "@/app/account/page";
import BillingPage from "@/app/account/billing/page";
import BuildPage from "@/app/worksheets/build/page";
const futureJwt = { code: "PGRST303", message: "JWT issued at future" };
beforeEach(() => {
  mocks.capture.mockReset();
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "owner" } } });
  mocks.query.mockReset().mockResolvedValue({ data: null, error: futureJwt });
  mocks.rpc.mockReset().mockResolvedValue({ data: [], error: null });
});
afterEach(() => vi.useRealTimers());
const NORMAL: Record<string, string> = {
  "dashboard": "Normal dashboard", "account": "Your access and security.",
  "account/billing": "Normal billing", "worksheets/build": "Normal builder",
};
describe.each([
  ["dashboard", "/dashboard", () => DashboardPage()],
  ["account", "/account", () => AccountPage({ searchParams: Promise.resolve({ checkout: "success" }) })],
  ["account/billing", "/account/billing", () => BillingPage()],
  // The retry keeps the requested bank so the builder reopens where the student was.
  ["worksheets/build", "/worksheets/build?bank=ib-economics-hl", () => BuildPage({ searchParams: Promise.resolve({ bank: "ib-economics-hl" }) })],
] as const)("%s access recovery", (route, retryPath, page) => {
  it("shows only manual recovery after the real read retry budget is exhausted", async () => {
    vi.useFakeTimers();
    const pending = page();
    // Attach immediately so the original throwing implementation has no unhandled rejection.
    const settled = pending.then(value => ({ value, error: null }), error => ({ value: null, error }));
    await vi.runAllTimersAsync();
    const result = await settled;
    expect(result.error).toBeNull();
    const html = renderToStaticMarkup(result.value);
    expect(html).toContain("We couldn&#x27;t check your access");
    expect(html).toContain(`href="${retryPath}"`);
    expect(html).toContain("Try again");
    expect(html).not.toMatch(/Checkout|Finishing your plan|Normal (?:dashboard|billing|builder)|unpaid|Upgrade|student@example.com/);
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
    expect(mocks.capture).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
      route: `/${route}`, route_type: "render", stage: "entitlement",
      storage_provider: "supabase", error_code: "PGRST303",
    });
    expect(JSON.stringify(mocks.capture.mock.calls)).not.toMatch(/owner|student@example.com/);
  });

  it.each([
    { code: "42501", message: "permission denied" },
    { code: "PGRST303", message: "JWT expired" },
    { code: "PGRST303", message: "JWT issued at future " },
    "JWT issued at future",
  ])("preserves unrelated or malformed failures: %j", async (failure) => {
    mocks.query.mockResolvedValue({ data: null, error: failure });
    await expect(page()).rejects.toEqual(failure);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("preserves an unrelated parallel error rather than offering clock recovery", async () => {
    const denied = { code: "42501", message: "permission denied" };
    mocks.rpc.mockResolvedValue({ data: null, error: denied });
    await expect(page()).rejects.toEqual(denied);
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed parallel response instead of showing recovery", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    await expect(page()).rejects.toThrow("Invalid billing access response");
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("renders normal content after a successful retry without reporting exhausted recovery", async () => {
    vi.useFakeTimers();
    mocks.query.mockResolvedValueOnce({ data: null, error: futureJwt }).mockResolvedValue({ data: [], error: null });
    const pending = page();
    await vi.runAllTimersAsync();
    const html = renderToStaticMarkup(await pending);
    expect(html).toContain(NORMAL[route]);
    expect(html).not.toContain("We couldn&#x27;t check your access");
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.capture).not.toHaveBeenCalled();
  });

  it("renders the normal page after successful empty reads", async () => {
    mocks.query.mockResolvedValue({ data: [], error: null });
    const html = renderToStaticMarkup(await page());
    expect(html).not.toContain("We couldn&#x27;t check your access");
    expect(html).toContain(NORMAL[route]);
  });
});
