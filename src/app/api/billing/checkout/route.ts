import { randomUUID } from "node:crypto";
import { getCheckoutReferral } from "@/lib/referral-account";
import { NextResponse } from "next/server";
import { BANK_PRODUCTS, hasBankAccess, type ProductId } from "@/lib/access";
import { getBillingBanks, getEntitlementBanks } from "@/lib/banks";
import { validateCustomBankIds } from "@/lib/custom-bundles";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { startCheckout } from "@/lib/stripe-checkout";
import { getBillingPlan, getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CheckoutBody = { interval?: unknown; productId?: unknown; selectedBankIds?: unknown; acknowledgeSeparateSubscription?: unknown };

function customIntegrationIdentifier(): string {
  const letters = randomUUID().replace(/[^a-f0-9]/gi, "").slice(0, 8).split("")
    .map((character) => String.fromCharCode(65 + (Number.parseInt(character, 16) % 26))).join("");
  return `pastpaperprep-custom-bundle-${letters}`;
}

class BillingStateConflictError extends Error {}

function safeBillingError(error: unknown) {
  if (error instanceof Error) return { name: error.name, message: error.message };
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      code: typeof record.code === "string" ? record.code : undefined,
      message: typeof record.message === "string" ? record.message : undefined,
      status: typeof record.status === "number" ? record.status : undefined,
    };
  }
  return { type: typeof error };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!isStripeBillingEnabled()) {
    return NextResponse.json({ error: "Billing is not available yet" }, { status: 503 });
  }

  let body: CheckoutBody;
  try {
    body = await request.json() as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  }

  let reservation: { admin: ReturnType<typeof createAdminClient>; intentId: string } | null = null;
  let sessionCreationAttempted = false;
  try {
    const config = getStripeConfig();
    const plan = getBillingPlan(body.productId, body.interval, config, body.selectedBankIds, process.env);
    const accessResult = await fetchAccessEntitlements(supabase as never, user.id);
    if (accessResult.error) throw accessResult.error;
    const entitlements = accessResult.rows as import("@/lib/access").AccessEntitlement[];
    const alreadyPaid = getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, entitlements));
    const paidBundle = alreadyPaid && (plan.productId === "bundle_custom" || plan.productId === "bundle_all");
    const alreadyAllAccess = entitlements.some((entitlement) => entitlement.productId === "bundle_all" && getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, [entitlement])));
    if (paidBundle && plan.productId === "bundle_all" && alreadyAllAccess) {
      return NextResponse.json({ error: "All Access is already covered" }, { status: 409 });
    }
    if (paidBundle && body.acknowledgeSeparateSubscription !== true) {
      return NextResponse.json({ error: "Acknowledge that this is a separate subscription and existing plans will continue unchanged" }, { status: 400 });
    }
    const requestedSlugs = plan.productId === "bundle_custom" && Array.isArray(body.selectedBankIds)
      ? body.selectedBankIds.filter((id): id is string => typeof id === "string")
      : [];
    const uncoveredSlugs = requestedSlugs.filter((slug) => !hasBankAccess(slug as Parameters<typeof hasBankAccess>[0], entitlements));
    const addOnBank = alreadyPaid && body.productId?.toString().startsWith("bank_")
      ? getBillingBanks().find(({ slug }) => BANK_PRODUCTS[slug] === plan.productId)?.slug
      : undefined;
    if (alreadyPaid && addOnBank && hasBankAccess(addOnBank, entitlements)) {
      return NextResponse.json({ error: "Choose a bank you do not already have; existing plans cannot be repurchased" }, { status: 409 });
    }
    if (paidBundle && plan.productId === "bundle_custom" && (requestedSlugs.length < 2 || requestedSlugs.length > 5 || uncoveredSlugs.length !== requestedSlugs.length)) {
      return NextResponse.json({ error: "Paid bundle selections must contain 2–5 uncovered banks" }, { status: 409 });
    }
    if (alreadyPaid && !paidBundle && !addOnBank) {
      return NextResponse.json({ error: "Choose a bank you do not already have; existing plans cannot be repurchased" }, { status: 409 });
    }
    const referralCode = await getCheckoutReferral(user.id);
    const admin = createAdminClient();
    const intentId = randomUUID();
    const { data: reservationGranted, error: reservationError } = await admin.rpc("reserve_billing_checkout", {
      p_user_id: user.id,
      p_intent_id: intentId,
    });
    if (reservationError) throw reservationError;
    if (reservationGranted !== true) {
      throw new BillingStateConflictError("Another checkout is already in progress");
    }
    reservation = { admin, intentId };
    const { data: mappedCustomerId, error: mappingError } = await admin.rpc("get_stripe_customer_id", {
      p_user_id: user.id,
    });
    if (mappingError) throw mappingError;
    const stripe = createStripeClient(config.secretKey);
    const claimCustomerId = async (customerId: string) => {
      const { data: canonicalCustomerId, error } = await admin.rpc("claim_stripe_customer", {
        p_user_id: user.id,
        p_customer_id: customerId,
      });
      if (error) throw error;
      if (typeof canonicalCustomerId !== "string" || !canonicalCustomerId) {
        throw new Error("Stripe customer claim did not return a customer");
      }
      return canonicalCustomerId;
    };
    const url = await startCheckout({
      interval: body.interval,
      productId: body.productId,
      selectedBankIds: body.selectedBankIds,
      user: { id: user.id, email: user.email },
      config,
      environment: process.env,
    }, {
      async findCustomerId(userId) {
        if (typeof mappedCustomerId === "string" && mappedCustomerId) return mappedCustomerId;
        const customers = await stripe.customers.search({
          query: `metadata['user_id']:'${userId}'`,
          limit: 2,
        });
        if (customers.data.length > 1) throw new Error("Multiple Stripe customers found");
        const customerId = customers.data[0]?.id;
        return customerId ? claimCustomerId(customerId) : null;
      },
      async createCustomer(checkoutUser) {
        const customer = await stripe.customers.create({
          email: checkoutUser.email,
          metadata: { user_id: checkoutUser.id },
        }, { idempotencyKey: `pastpaperprep-customer-${checkoutUser.id}` });
        return customer.id;
      },
      async saveCustomer(userId, customerId) {
        if (userId !== user.id) throw new Error("Stripe customer claim user mismatch");
        return claimCustomerId(customerId);
      },
      async createSession(input) {
        let startingAfter: string | undefined;
        let billingConflict = false;
        do {
          const subscriptions = await stripe.subscriptions.list({
            customer: input.customerId,
            status: "all",
            limit: 100,
            ...(startingAfter ? { starting_after: startingAfter } : {}),
          });
          billingConflict = false;
          for (const subscription of subscriptions.data) {
            if (subscription.status === "canceled" || subscription.status === "incomplete_expired") continue;
            if (!addOnBank && !paidBundle) { billingConflict = true; break; }
            if (subscription.status !== "active" && subscription.status !== "trialing") { billingConflict = true; break; }
            const product = subscription.metadata?.product_id;
            const items = subscription.items?.data;
            if (!product || !Array.isArray(items) || items.length !== 1) { billingConflict = true; break; }
            const item = items[0];
            const priceId = typeof item.price === "string" ? item.price : item.price?.id;
            const actualInterval = item.price && typeof item.price !== "string" ? item.price.recurring?.interval : undefined;
            const interval = actualInterval === "month" ? "monthly" : actualInterval === "year" ? "annual" : null;
            if (!priceId || !interval || !Number.isInteger(item.quantity) || (item.quantity ?? 0) < 1) { billingConflict = true; break; }
            const { data: catalogRows, error: catalogError } = await admin.rpc("get_checkout_price_catalog", { p_price_id: priceId });
            if (catalogError || !Array.isArray(catalogRows)) throw catalogError ?? new Error("Checkout price catalog lookup failed");
            const catalog = catalogRows.find((row: { product_id?: unknown; billing_interval?: unknown }) => row.product_id === product && row.billing_interval === interval);
            if (!catalog) { billingConflict = true; break; }
            const targets = paidBundle ? plan.productId === "bundle_all" ? [] : uncoveredSlugs : [addOnBank!];
            if (product === "bundle_custom") {
              let selected: ReturnType<typeof validateCustomBankIds>;
              try { selected = validateCustomBankIds(JSON.parse(subscription.metadata.selected_bank_ids ?? "")); } catch { billingConflict = true; break; }
              if (selected.length !== item.quantity) { billingConflict = true; break; }
              if (selected.some((id) => targets.includes(id))) { billingConflict = true; break; }
              continue;
            }
            if (item.quantity !== 1 || subscription.metadata.selected_bank_ids) { billingConflict = true; break; }
            const recorded = { productId: product as ProductId, status: "active" as const, startsAt: "2020-01-01T00:00:00Z", expiresAt: null };
            if (targets.some((target) => hasBankAccess(target as Parameters<typeof hasBankAccess>[0], [recorded])) || !getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, [recorded]))) { billingConflict = true; break; }
          }
          if (billingConflict || !subscriptions.has_more) break;
          startingAfter = subscriptions.data.at(-1)?.id;
          if (!startingAfter) throw new Error("Stripe subscription pagination did not advance");
        } while (true);
        const openSessionData = [];
        let openSessionStartingAfter: string | undefined;
        do {
          const openSessions = await stripe.checkout.sessions.list({
            customer: input.customerId,
            status: "open",
            limit: 100,
            ...(openSessionStartingAfter ? { starting_after: openSessionStartingAfter } : {}),
          });
          openSessionData.push(...openSessions.data);
          if (!openSessions.has_more) break;
          openSessionStartingAfter = openSessions.data.at(-1)?.id;
          if (!openSessionStartingAfter) throw new Error("Stripe Checkout Session pagination did not advance");
        } while (true);
        if (billingConflict) {
          throw new BillingStateConflictError("Existing Stripe billing state conflicts with this bank purchase");
        }
        const minimumUsableExpiry = Math.floor(Date.now() / 1000) + 60;
        const matchingOpenSession = openSessionData.find(({ expires_at, metadata }) => (
          // A paid bundle's consent belongs to this newly reserved intent, not an earlier Checkout Session.
          (!paidBundle || metadata?.billing_intent_id === intentId)
          && typeof expires_at === "number"
          && expires_at > minimumUsableExpiry
          && metadata?.user_id === input.userId
          && metadata.product_id === input.productId
          && metadata.billing_interval === input.interval
          && metadata.price_id === input.priceId
          && metadata.referral_code === (referralCode ?? undefined)
          && metadata.acknowledge_separate_subscription === (paidBundle ? "true" : undefined)
          && metadata.selected_bank_ids === (input.selectedBankIds ? JSON.stringify(input.selectedBankIds) : undefined)
        ));
        const openSessionUrl = matchingOpenSession?.url;
        if (typeof openSessionUrl === "string" && openSessionUrl) {
          if (addOnBank || paidBundle) {
            const { data: stillEligible, error: eligibilityError } = await admin.rpc(addOnBank ? "confirm_addon_billing_checkout" : "confirm_paid_bundle_billing_checkout", addOnBank
              ? { p_user_id: user.id, p_intent_id: intentId, p_product_id: input.productId }
              : { p_user_id: user.id, p_intent_id: intentId, p_product_id: input.productId, p_selected_bank_ids: plan.productId === "bundle_all" ? [] : uncoveredSlugs, p_acknowledged: true });
            if (eligibilityError) throw eligibilityError;
            if (stillEligible !== true) throw new BillingStateConflictError("Bank access changed; reload pricing before checkout");
          }
          return openSessionUrl;
        }
        await Promise.all(openSessionData.map(({ id }) => stripe.checkout.sessions.expire(id)));
        const { data: checkoutConfirmed, error: confirmationError } = await admin.rpc(paidBundle ? "confirm_paid_bundle_billing_checkout" : addOnBank ? "confirm_addon_billing_checkout" : "confirm_billing_checkout", {
          p_user_id: user.id,
          p_intent_id: intentId,
          ...(paidBundle ? { p_product_id: input.productId, p_selected_bank_ids: plan.productId === "bundle_all" ? [] : uncoveredSlugs, p_acknowledged: true } : {}),
          ...(addOnBank ? { p_product_id: input.productId } : {}),
        });
        if (confirmationError) throw confirmationError;
        if (checkoutConfirmed !== true) {
          throw new BillingStateConflictError("Access or billing state changed; manage it from your account");
        }
        sessionCreationAttempted = true;
        const selectedBankMetadata = input.selectedBankIds ? JSON.stringify(input.selectedBankIds) : undefined;
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: input.customerId,
          client_reference_id: input.userId,
          line_items: [{ price: input.priceId, quantity: input.quantity ?? 1 }],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          allow_promotion_codes: true,
          subscription_data: {
            metadata: input.productId === "bundle_custom"
              ? {
                user_id: input.userId,
                product_id: input.productId,
                selected_bank_ids: selectedBankMetadata!,
                billing_interval: input.interval,
                price_id: input.priceId,
                ...(paidBundle ? { billing_intent_id: intentId, acknowledge_separate_subscription: "true" } : {}),
                ...(referralCode ? { referral_code: referralCode } : {}),
              }
              : { user_id: input.userId, product_id: input.productId, ...(paidBundle ? { billing_intent_id: intentId, acknowledge_separate_subscription: "true" } : {}), ...(referralCode ? { referral_code: referralCode } : {}) },
          },
          metadata: {
            user_id: input.userId,
            product_id: input.productId,
            ...(selectedBankMetadata ? { selected_bank_ids: selectedBankMetadata } : {}),
            ...(paidBundle ? { billing_intent_id: intentId, acknowledge_separate_subscription: "true" } : {}),
            billing_interval: input.interval,
            price_id: input.priceId,
            ...(referralCode ? { referral_code: referralCode } : {}),
          },
          integration_identifier: `${input.productId === "bundle_custom" ? "pastpaperprep-custom-bundle" : "pastpaperprep-fixed-plan"}-${customIntegrationIdentifier().split("-").at(-1)}`,
        } as Parameters<typeof stripe.checkout.sessions.create>[0], {
          idempotencyKey: `pastpaperprep-checkout-${intentId}`,
          timeout: 30_000,
        });
        if (!session.url) throw new Error("Stripe did not return a checkout URL");
        return session.url;
      },
    });

    // Retain the lease while this Checkout Session is open. The next request
    // must wait for lease expiry and then inspect open sessions at Stripe.
    return NextResponse.json({ url });
  } catch (error) {
    if (reservation && !sessionCreationAttempted) {
      const { error: releaseError } = await reservation.admin.rpc("release_billing_checkout", {
        p_user_id: user.id,
        p_intent_id: reservation.intentId,
      });
      if (releaseError) console.error("Stripe checkout reservation release failed", safeBillingError(releaseError));
    }
    if (error instanceof BillingStateConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && (
      error.message === "Unknown billing interval"
      || error.message === "Unknown billing product"
      || error.message === "Bank selection must be an array"
      || error.message === "Unknown bank"
      || error.message === "Duplicate bank"
      || error.message === "Select at least one bank"
      || error.message === "Select at least two banks"
      || error.message === "Select no more than five banks"
      || error.message === "Bank is not available for checkout"
    )) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Stripe checkout creation failed", safeBillingError(error));
    return NextResponse.json({ error: "Checkout is temporarily unavailable" }, { status: 503 });
  }
}
