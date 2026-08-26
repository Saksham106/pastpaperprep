import { NextResponse } from "next/server";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isStripeBillingEnabled()) {
    return NextResponse.json({ error: "Billing is not available yet" }, { status: 503 });
  }

  try {
    const config = getStripeConfig();
    const stripe = createStripeClient(config.secretKey);
    const admin = createAdminClient();
    const { data: customerId, error: mappingError } = await admin.rpc("get_stripe_customer_id", {
      p_user_id: user.id,
    });
    if (mappingError) throw mappingError;
    if (typeof customerId !== "string" || !customerId) {
      return NextResponse.json({ error: "No billing account found" }, { status: 404 });
    }
    const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
    const defaultConfiguration = configurations.data.find((configuration) => configuration.is_default);
    if (!defaultConfiguration || defaultConfiguration.features.subscription_update.enabled !== false) {
      throw new Error("Safe billing portal configuration is unavailable");
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: defaultConfiguration.id,
      return_url: `${config.siteUrl}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal creation failed", safeBillingError(error));
    return NextResponse.json({ error: "Billing portal is temporarily unavailable" }, { status: 503 });
  }
}
