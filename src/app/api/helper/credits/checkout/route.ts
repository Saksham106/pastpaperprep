import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { formatCredits, HELPER_PACK_CURRENCY, helperPack } from "@/lib/helper/credits";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// One-time Pepper credit packs. The browser names a pack id; the price, credits and metadata come from the server's
// fixed list, and the webhook credits the pack once, only after Stripe reports it paid.

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

async function handlePOST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request" }, 400);
  const pack = helperPack((body as { pack?: unknown }).pack);
  if (!pack) return json({ error: "Unknown credit pack" }, 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return json({ error: "Sign in required" }, 401);
  if (!isStripeBillingEnabled()) return json({ error: "Billing is not available yet", code: "BILLING_UNAVAILABLE" }, 503);

  try {
    const config = getStripeConfig();
    const stripe = createStripeClient(config.secretKey);
    const admin = createAdminClient();
    const { data: mapped, error: mapError } = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (mapError) throw mapError;
    let customerId = typeof mapped === "string" ? mapped : null;
    if (!customerId) {
      const found = await stripe.customers.search({ query: `metadata['user_id']:'${user.id}'`, limit: 2 });
      if (found.data.length > 1) throw new Error("Multiple Stripe customers mapped to account");
      customerId = found.data[0]?.id ?? null;
      if (!customerId) customerId = (await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } }, { idempotencyKey: `pastpaperprep-customer-${user.id}` })).id;
      const { data: claimed, error } = await admin.rpc("claim_stripe_customer", { p_user_id: user.id, p_customer_id: customerId });
      if (error || claimed !== customerId) throw error ?? new Error("Could not claim Stripe customer");
    }

    const intentId = randomUUID();
    const metadata = { user_id: user.id, purchase_type: "helper_credits", pack_id: pack.id, credits: String(pack.credits), billing_intent_id: intentId };
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: HELPER_PACK_CURRENCY,
          unit_amount: pack.amountCents,
          product_data: {
            name: `${formatCredits(pack.credits)} Pepper credits`,
            description: "One-time pack. Used after your weekly credits run out; lasts 12 months.",
            metadata: { purchase_type: "helper_credits", pack_id: pack.id },
          },
        },
      }],
      success_url: `${config.siteUrl}/account?credits=success#pepper-credits`,
      cancel_url: `${config.siteUrl}/account#pepper-credits`,
      metadata,
      payment_intent_data: { metadata },
    }, { idempotencyKey: `pastpaperprep-helper-credits-${intentId}`, timeout: 30_000 });
    if (!session.url) throw new Error("Stripe did not return checkout URL");
    return json({ url: session.url });
  } catch (error) {
    console.error("Helper credit checkout failed", error instanceof Error ? { name: error.name, message: error.message } : { type: typeof error });
    return json({ error: "Checkout is temporarily unavailable", code: "CHECKOUT_UNAVAILABLE" }, 503);
  }
}

export const POST = withFailureReporting("/api/helper/credits/checkout", handlePOST);
