import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasBankAccess } from "@/lib/access";
import { BANKS } from "@/lib/banks";
import { normalizeEntitlements } from "@/lib/entitlements";
import { startCheckout } from "@/lib/stripe-checkout";
import { getBillingPlan, getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CheckoutBody = { interval?: unknown; productId?: unknown };

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
    getBillingPlan(body.productId, body.interval, config);
    const { data: entitlementRows, error: entitlementError } = await supabase
      .from("entitlements")
      .select("product_id, status, starts_at, expires_at")
      .eq("user_id", user.id);
    if (entitlementError) throw entitlementError;
    const entitlements = normalizeEntitlements(entitlementRows ?? []);
    if (BANKS.some(({ slug }) => hasBankAccess(slug, entitlements))) {
      return NextResponse.json({ error: "Existing access must be managed from your account" }, { status: 409 });
    }
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
      user: { id: user.id, email: user.email },
      config,
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
        let hasNonTerminalSubscription = false;
        do {
          const subscriptions = await stripe.subscriptions.list({
            customer: input.customerId,
            status: "all",
            limit: 100,
            ...(startingAfter ? { starting_after: startingAfter } : {}),
          });
          hasNonTerminalSubscription = subscriptions.data.some(({ status }) => (
            status !== "canceled" && status !== "incomplete_expired"
          ));
          if (hasNonTerminalSubscription || !subscriptions.has_more) break;
          startingAfter = subscriptions.data.at(-1)?.id;
          if (!startingAfter) throw new Error("Stripe subscription pagination did not advance");
        } while (true);
        const openSessions = await stripe.checkout.sessions.list({
          customer: input.customerId,
          status: "open",
          limit: 1,
        });
        if (hasNonTerminalSubscription || openSessions.data.length > 0) {
          throw new BillingStateConflictError("Existing Stripe billing state must be managed from your account");
        }
        const { data: checkoutConfirmed, error: confirmationError } = await admin.rpc("confirm_billing_checkout", {
          p_user_id: user.id,
          p_intent_id: intentId,
        });
        if (confirmationError) throw confirmationError;
        if (checkoutConfirmed !== true) {
          throw new BillingStateConflictError("Access or billing state changed; manage it from your account");
        }
        sessionCreationAttempted = true;
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: input.customerId,
          client_reference_id: input.userId,
          line_items: [{ price: input.priceId, quantity: 1 }],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          allow_promotion_codes: true,
          subscription_data: {
            metadata: { user_id: input.userId, product_id: input.productId },
          },
          metadata: {
            user_id: input.userId,
            product_id: input.productId,
            billing_interval: input.interval,
          },
        }, {
          idempotencyKey: `pastpaperprep-checkout-${intentId}`,
          timeout: 30_000,
        });
        if (!session.url) throw new Error("Stripe did not return a checkout URL");
        return session.url;
      },
    });

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
    if (error instanceof Error && (error.message === "Unknown billing interval" || error.message === "Unknown billing product")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Stripe checkout creation failed", safeBillingError(error));
    return NextResponse.json({ error: "Checkout is temporarily unavailable" }, { status: 503 });
  }
}
