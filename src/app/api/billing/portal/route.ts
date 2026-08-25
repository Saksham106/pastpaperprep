import { NextResponse } from "next/server";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!isStripeBillingEnabled()) {
    return NextResponse.json({ error: "Billing is not available yet" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("stripe_customers")
    .select("customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Billing is temporarily unavailable" }, { status: 503 });
  if (!data?.customer_id) return NextResponse.json({ error: "No billing account found" }, { status: 404 });

  try {
    const config = getStripeConfig();
    const stripe = createStripeClient(config.secretKey);
    const session = await stripe.billingPortal.sessions.create({
      customer: data.customer_id,
      return_url: `${config.siteUrl}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Billing is temporarily unavailable" }, { status: 503 });
  }
}
