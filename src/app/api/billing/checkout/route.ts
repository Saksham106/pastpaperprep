import { NextResponse } from "next/server";
import { startCheckout } from "@/lib/stripe-checkout";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CheckoutBody = { interval?: unknown };

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

  try {
    const config = getStripeConfig();
    const stripe = createStripeClient(config.secretKey);
    const admin = createAdminClient();
    const url = await startCheckout({
      interval: body.interval,
      user: { id: user.id, email: user.email },
      config,
    }, {
      async findCustomerId(userId) {
        const { data, error } = await supabase
          .from("stripe_customers")
          .select("customer_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        return data?.customer_id ?? null;
      },
      async createCustomer(checkoutUser) {
        const customer = await stripe.customers.create({
          email: checkoutUser.email,
          metadata: { user_id: checkoutUser.id },
        }, { idempotencyKey: `pastpaperprep-customer-${checkoutUser.id}` });
        return customer.id;
      },
      async saveCustomer(userId, customerId) {
        const { error } = await admin
          .from("stripe_customers")
          .upsert({ user_id: userId, customer_id: customerId }, { onConflict: "user_id" });
        if (error) throw error;
      },
      async createSession(input) {
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          customer: input.customerId,
          client_reference_id: input.userId,
          line_items: [{ price: input.priceId, quantity: 1 }],
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          allow_promotion_codes: false,
          subscription_data: {
            metadata: { user_id: input.userId, product_id: "bundle_all" },
          },
          metadata: {
            user_id: input.userId,
            product_id: "bundle_all",
            billing_interval: input.interval,
          },
        });
        if (!session.url) throw new Error("Stripe did not return a checkout URL");
        return session.url;
      },
    });

    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof Error && error.message === "Unknown billing interval") {
      return NextResponse.json({ error: "Unknown billing interval" }, { status: 400 });
    }
    return NextResponse.json({ error: "Checkout is temporarily unavailable" }, { status: 503 });
  }
}
