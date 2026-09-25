import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const getUser = vi.fn(); const adminRpc = vi.fn();
const subscriptionsList = vi.fn(); const invoicesList = vi.fn(); const customersRetrieve = vi.fn(); const pricesRetrieve = vi.fn(); const schedulesRetrieve = vi.fn();
let billingEnabled = true;
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ rpc: adminRpc })) }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: vi.fn(() => ({ subscriptions: { list: subscriptionsList }, subscriptionSchedules: { retrieve: schedulesRetrieve }, invoices: { list: invoicesList }, customers: { retrieve: customersRetrieve }, prices: { retrieve: pricesRetrieve } })) }));
vi.mock("@/lib/stripe-config", () => ({ isStripeBillingEnabled: () => billingEnabled, getStripeConfig: () => ({ secretKey: "«redacted:sk_test_…»", singleMonthlyPriceId: "price_single", singleAnnualPriceId: "price_single_annual" }) }));
import { GET } from "@/app/api/billing/subscription/route";
import { getBillingBanks } from "@/lib/banks";
import { BANK_PRODUCTS } from "@/lib/access";

describe("GET /api/billing/subscription", () => {
 beforeEach(() => { vi.clearAllMocks(); billingEnabled = true; delete process.env.STRIPE_PLAN_EDITOR_ENABLED; });
 it("rejects hostile unauthenticated reads before querying Stripe", async () => {
  getUser.mockResolvedValue({ data: { user: null } });
  const response = await GET();
  expect(response.status).toBe(401); expect(response.headers.get("cache-control")).toContain("no-store"); expect(subscriptionsList).not.toHaveBeenCalled();
 });
 it("reads provider subscriptions, invoices, and payment method only for the mapped account", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "user-a", email: "a@example.com" } } });
  adminRpc.mockResolvedValue({ data: "cus_a", error: null });
  subscriptionsList.mockResolvedValue({ data: [{ id: "sub_a", customer: "cus_a", status: "active", current_period_start: 10, current_period_end: 20, cancel_at_period_end: false, items: { data: [{ id: "si_a", quantity: 2, current_period_start: 10, current_period_end: 20, price: { id: "price_a", unit_amount: 1000, currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] }, metadata: { user_id: "user-a", product_id: "bundle_custom", selected_bank_ids: '["ib-sl","igcse"]' } }] });
  invoicesList.mockResolvedValue({ data: [{ id: "in_a", customer: "cus_a", status: "paid", amount_paid: 2000, currency: "usd", created: 1, period_start: 10, period_end: 20, hosted_invoice_url: "https://invoice.stripe.test/a" }] });
  customersRetrieve.mockResolvedValue({ id: "cus_a", invoice_settings: { default_payment_method: { id: "pm_a", type: "us_bank_account", us_bank_account: { bank_name: "Example Bank", last4: "4321" } } } });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(adminRpc).toHaveBeenCalledWith("get_stripe_customer_id", { p_user_id: "user-a" });
  expect(subscriptionsList).toHaveBeenCalledWith({ customer: "cus_a", status: "all", limit: 100 });
  expect(invoicesList).toHaveBeenCalledWith({ customer: "cus_a", limit: 20 });
  expect(customersRetrieve).toHaveBeenCalledWith("cus_a", { expand: ["invoice_settings.default_payment_method"] });
  await expect(response.json()).resolves.toMatchObject({ subscriptions: [{ id: "sub_a", metadata: { productId: "bundle_custom" } }], invoices: [{ id: "in_a", amountPaid: 2000 }], paymentMethod: { type: "us_bank_account", bankName: "Example Bank", last4: "4321" } });
 });
 it("fails closed if a subscription under the mapped customer belongs to a different user", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  adminRpc.mockResolvedValue({ data: "cus_a", error: null });
  subscriptionsList.mockResolvedValue({ has_more: false, data: [{ id: "sub_other", customer: "cus_a", metadata: { user_id: "user-b" }, items: { data: [] } }] });
  invoicesList.mockResolvedValue({ has_more: false, data: [] });
  customersRetrieve.mockResolvedValue({ id: "cus_a", deleted: false, invoice_settings: { default_payment_method: null } });
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "Subscription details are temporarily unavailable" });
 });
 it("shows a legacy subscription without owner metadata only under the uniquely mapped Stripe customer", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  adminRpc.mockResolvedValue({ data: "cus_a", error: null });
  subscriptionsList.mockResolvedValue({ has_more: false, data: [{ id: "sub_unknown", customer: "cus_a", status: "active", metadata: { product_id: "bundle_custom" }, items: { data: [] } }] });
  invoicesList.mockResolvedValue({ has_more: false, data: [] });
  customersRetrieve.mockResolvedValue({ id: "cus_a", deleted: false, invoice_settings: { default_payment_method: null } });
  const response = await GET();
  expect(response.status).toBe(200);
  expect((await response.json()).subscriptions).toMatchObject([{ id: "sub_unknown" }]);
  process.env.STRIPE_PLAN_EDITOR_ENABLED = "true";
  const flagged = await GET();
  expect((await flagged.json()).management.editable).toBe(false);
 });
 it("fails closed if Stripe returns an invoice for another customer", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  adminRpc.mockResolvedValue({ data: "cus_a", error: null });
  subscriptionsList.mockResolvedValue({ has_more: false, data: [] });
  invoicesList.mockResolvedValue({ has_more: false, data: [{ id: "in_other", customer: "cus_other", created: 1, status: "paid", amount_due: 600, amount_paid: 600, currency: "usd" }] });
  customersRetrieve.mockResolvedValue({ id: "cus_a", deleted: false, invoice_settings: { default_payment_method: null } });
  expect((await GET()).status).toBe(503);
 });
 it("resolves graduated plan rate from Stripe tiers rather than displaying a guessed unit amount", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  adminRpc.mockResolvedValue({ data: "cus_a", error: null });
  subscriptionsList.mockResolvedValue({ has_more: false, data: [{ id: "sub_a", customer: "cus_a", status: "active", cancel_at_period_end: false, metadata: { user_id: "user-a", product_id: "bundle_custom", selected_bank_ids: '["igcse","ib-hl"]' }, items: { data: [{ id: "si_a", quantity: 2, current_period_start: 10, current_period_end: 20, price: { id: "price_tiered", billing_scheme: "tiered", unit_amount: null, currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] } }] });
  invoicesList.mockResolvedValue({ has_more: false, data: [] });
  customersRetrieve.mockResolvedValue({ id: "cus_a", deleted: false, invoice_settings: { default_payment_method: null } });
  pricesRetrieve.mockResolvedValue({ id: "price_tiered", billing_scheme: "tiered", tiers_mode: "graduated", unit_amount: null, currency: "usd", tiers: [{ up_to: 1, unit_amount: 600, flat_amount: 0 }, { up_to: null, unit_amount: 400, flat_amount: 0 }] });
  const response = await GET();
  expect(response.status).toBe(200);
  expect(pricesRetrieve).toHaveBeenCalledWith("price_tiered", { expand: ["tiers"] });
  expect((await response.json()).subscriptions[0]).toMatchObject({ bankSelection: { kind: "selected", banks: expect.arrayContaining([expect.objectContaining({ slug: "igcse" }), expect.objectContaining({ slug: "ib-hl" })]) }, items: [{ recurringSubtotalCents: 1000 }] });
 });
 it("does not substitute guessed totals or expose billing data when customer mapping is absent", async () => {
  getUser.mockResolvedValue({ data: { user: { id: "user-a", email: "a@example.com" } } }); adminRpc.mockResolvedValue({ data: null, error: null });
  const response = await GET(); expect(response.status).toBe(404); expect(subscriptionsList).not.toHaveBeenCalled();
 });
 it("shows verified future selection and undo only for an app-owned phase-zero schedule", async () => {
  const [first, second] = getBillingBanks();
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } } }); adminRpc.mockResolvedValue({ data: "cus_a", error: null });
  const currentMetadata = { user_id: "user-a", product_id: "bundle_custom", selected_bank_ids: JSON.stringify([first.slug, second.slug].sort()) };
  const currentItem = { id: "si_a", quantity: 2, current_period_start: 1_800_000_000, current_period_end: 1_900_000_000, price: { id: "price_current", billing_scheme: "per_unit", unit_amount: 500, currency: "usd", recurring: { interval: "month", interval_count: 1 } } };
  subscriptionsList.mockResolvedValue({ has_more: false, data: [{ id: "sub_a", customer: "cus_a", schedule: "sc1", status: "active", metadata: currentMetadata, items: { data: [currentItem] } }] });
  invoicesList.mockResolvedValue({ has_more: false, data: [] }); customersRetrieve.mockResolvedValue({ id: "cus_a", invoice_settings: { default_payment_method: null } });
  schedulesRetrieve.mockResolvedValue({ id: "sc1", customer: "cus_a", subscription: "sub_a", status: "active", current_phase: { start_date: 1_800_000_000, end_date: 1_900_000_000 },
   metadata: { owner: "pastpaperprep", user_id: "user-a", subscription_id: "sub_a", ownership_id: "63c06037-9807-4a50-9506-004d828c5341" }, phases: [
    { start_date: 1_800_000_000, end_date: 1_900_000_000, items: [{ price: "price_current", quantity: 2 }], metadata: currentMetadata },
    { start_date: 1_900_000_000, end_date: 1_910_000_000, items: [{ price: "price_single", quantity: 1 }], metadata: { user_id: "user-a", product_id: BANK_PRODUCTS[first.slug], selected_bank_ids: "", price_id: "price_single", billing_interval: "monthly" } },
   ] });
  process.env.STRIPE_PLAN_EDITOR_ENABLED = "true";
  const response = await GET(); expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.management.editable).toBe(false);
  expect(result.subscriptions[0].scheduledPlan).toMatchObject({ id: "sc1", bankSelection: { kind: "selected", banks: [{ slug: first.slug }] }, effectiveAt: new Date(1_900_000_000_000).toISOString(), interval: "monthly" });
  schedulesRetrieve.mockResolvedValueOnce({ id: "sc1", metadata: { owner: "other" }, phases: [] });
  expect((await (await GET()).json()).subscriptions[0].scheduledPlan).toBe(null);
 });
 it("offers editing only behind the flag for a single structurally standard subscription, including undo of period-end cancellation", async () => {
  const bank = getBillingBanks()[0];
  expect(bank).toBeDefined();
  getUser.mockResolvedValue({ data: { user: { id: "user-a" } } });
  adminRpc.mockResolvedValue({ data: "cus_a", error: null });
  const subscription = { id: "sub_a", customer: "cus_a", status: "active", cancel_at_period_end: true, cancel_at: 1900000000, schedule: null, pending_update: null, metadata: { user_id: "user-a", product_id: BANK_PRODUCTS[bank.slug] }, items: { data: [{ id: "si_a", quantity: 1, current_period_end: 1900000000, price: { id: "price_single", billing_scheme: "per_unit", unit_amount: 600, currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] } };
  subscriptionsList.mockResolvedValue({ has_more: false, data: [subscription] });
  invoicesList.mockResolvedValue({ has_more: false, data: [] });
  customersRetrieve.mockResolvedValue({ id: "cus_a", deleted: false, invoice_settings: { default_payment_method: null } });
  process.env.STRIPE_PLAN_EDITOR_ENABLED = "true";
  const ready = await GET(); expect(ready.status).toBe(200);
  expect(await ready.json()).toMatchObject({ management: { editable: true }, bankOptions: expect.arrayContaining([{ slug: bank.slug, name: bank.shortName }]) });
  subscriptionsList.mockResolvedValue({ has_more: false, data: [{ ...subscription, metadata: { product_id: BANK_PRODUCTS[bank.slug] } }] });
  const legacy = await GET(); expect((await legacy.json()).management.editable).toBe(false);
  subscriptionsList.mockResolvedValue({ has_more: false, data: [{ ...subscription, items: { data: [{ ...subscription.items.data[0], price: { ...subscription.items.data[0].price, id: "legacy_price" } }] } }] });
  const grandfathered = await GET(); expect((await grandfathered.json()).management.editable).toBe(false);
  delete process.env.STRIPE_PLAN_EDITOR_ENABLED;
  subscriptionsList.mockResolvedValue({ has_more: false, data: [subscription] });
  const off = await GET(); expect((await off.json()).management.editable).toBe(false);
 });
});
