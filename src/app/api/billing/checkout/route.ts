import { randomUUID } from "node:crypto";
import { getCheckoutReferral } from "@/lib/referral-account";
import { NextResponse } from "next/server";
import { BANK_PRODUCTS, hasBankAccess, type ProductId } from "@/lib/access";
import { getBillingBanks, getEntitlementBanks } from "@/lib/banks";
import { normalizeEntitlements } from "@/lib/entitlements";
import { startCheckout } from "@/lib/stripe-checkout";
import { getBillingPlan, getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CheckoutBody = { interval?: unknown; productId?: unknown; selectedBankIds?: unknown };

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
    const { data: entitlementRows, error: entitlementError } = await supabase
      .from("entitlements")
      .select("product_id, selected_bank_ids, status, starts_at, expires_at")
      .eq("user_id", user.id);
    if (entitlementError) throw entitlementError;
    const entitlements = normalizeEntitlements(entitlementRows ?? []);
    const alreadyPaid = getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, entitlements));
    const addOnBank = alreadyPaid ? getBillingBanks().find(({ slug }) => BANK_PRODUCTS[slug] === plan.productId)?.slug : undefined;
    if (alreadyPaid && (!addOnBank || hasBankAccess(addOnBank, entitlements))) {
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
          billingConflict = subscriptions.data.some((subscription) => {
            if (subscription.status === "canceled" || subscription.status === "incomplete_expired") return false;
            if (!addOnBank) return true;
            // Existing, unrelated subscriptions are valid. Unknown or unsettled billing
            // state is not: failing closed prevents duplicate or overlapping charges.
            if (subscription.status !== "active" && subscription.status !== "trialing") return true;
            const product = subscription.metadata?.product_id;
            if (!product || product === input.productId || product === "bundle_all") return true;
            if (product === "bundle_custom") {
              try {
                const selected = JSON.parse(subscription.metadata.selected_bank_ids ?? "") as unknown;
                return !Array.isArray(selected) || selected.some((id) => id === addOnBank);
              } catch { return true; }
            }
            const recorded = { productId: product as ProductId, status: "active" as const, startsAt: "2020-01-01T00:00:00Z", expiresAt: null };
            // A missing/unknown product cannot be proven disjoint from the add-on.
            return hasBankAccess(addOnBank, [recorded]) || !getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, [recorded]));
          });
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
          typeof expires_at === "number"
          && expires_at > minimumUsableExpiry
          && metadata?.user_id === input.userId
          && metadata.product_id === input.productId
          && metadata.billing_interval === input.interval
          && metadata.price_id === input.priceId
          && metadata.referral_code === (referralCode ?? undefined)
          && metadata.selected_bank_ids === (input.selectedBankIds ? JSON.stringify(input.selectedBankIds) : undefined)
        ));
        const openSessionUrl = matchingOpenSession?.url;
        if (typeof openSessionUrl === "string" && openSessionUrl) {
          if (addOnBank) {
            const { data: stillEligible, error: eligibilityError } = await admin.rpc("confirm_addon_billing_checkout", { p_user_id: user.id, p_intent_id: intentId, p_product_id: input.productId });
            if (eligibilityError) throw eligibilityError;
            if (stillEligible !== true) throw new BillingStateConflictError("Bank access changed; reload pricing before checkout");
          }
          return openSessionUrl;
        }
        await Promise.all(openSessionData.map(({ id }) => stripe.checkout.sessions.expire(id)));
        const { data: checkoutConfirmed, error: confirmationError } = await admin.rpc(addOnBank ? "confirm_addon_billing_checkout" : "confirm_billing_checkout", {
          p_user_id: user.id,
          p_intent_id: intentId,
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
                ...(referralCode ? { referral_code: referralCode } : {}),
              }
              : { user_id: input.userId, product_id: input.productId, ...(referralCode ? { referral_code: referralCode } : {}) },
          },
          metadata: {
            user_id: input.userId,
            product_id: input.productId,
            ...(selectedBankMetadata ? { selected_bank_ids: selectedBankMetadata } : {}),
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

    const { error: releaseError } = await admin.rpc("release_billing_checkout", {
      p_user_id: user.id,
      p_intent_id: intentId,
    });
    if (releaseError) console.error("Stripe checkout reservation release failed", safeBillingError(releaseError));
    reservation = null;

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
