import type Stripe from "stripe";

import type { createAdminClient } from "@/lib/supabase/admin";
import { BANK_PRODUCTS } from "@/lib/access";

type Admin = ReturnType<typeof createAdminClient>;
type StripeClient = Pick<Stripe, "subscriptions">;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sameSet = (a: unknown, b: unknown) => Array.isArray(a) && Array.isArray(b) && [...a].sort().join("\0") === [...b].sort().join("\0");
const idOf = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;
function selectedBanks(sub: Stripe.Subscription): string[] | null {
  const product = sub.metadata?.product_id;
  const raw = sub.metadata?.selected_bank_ids;
  if (product === "bundle_custom") {
    try {
      const parsed: unknown = JSON.parse(raw ?? "null");
      return Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 5 && parsed.every((id) => typeof id === "string" && id in BANK_PRODUCTS) && new Set(parsed).size === parsed.length ? parsed : null;
    } catch { return null; }
  }
  if (raw != null && raw !== "") return null;
  if (product === "bundle_all") return [];
  const matches = Object.entries(BANK_PRODUCTS).filter(([, id]) => id === product).map(([bank]) => bank);
  return matches.length === 1 ? matches : null;
}

export async function finishLifetimeConversion(admin: Admin, stripe: StripeClient, input: {
  intentId: string; userId: string; customerId: string; sessionId: string; paymentIntentId: string;
}) {
  if (!uuid.test(input.intentId) || !uuid.test(input.userId) || !/^cus_[A-Za-z0-9]+$/.test(input.customerId) || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(input.sessionId) || !/^pi_[A-Za-z0-9]+$/.test(input.paymentIntentId)) throw new Error("Invalid conversion identifiers");
  const { data: conversion, error } = await admin.from("lifetime_conversions").select("*").eq("intent_id", input.intentId).maybeSingle();
  if (error || !conversion || conversion.user_id !== input.userId || conversion.customer_id !== input.customerId || conversion.status === "expired" || !["pending", "paid", "renewals_stopped"].includes(conversion.status)) throw new Error("Conversion target unavailable");
  const { data: purchase, error: purchaseError } = await admin.from("lifetime_purchases").select("*").eq("user_id", input.userId).eq("checkout_session_id", input.sessionId).eq("payment_intent_id", input.paymentIntentId).maybeSingle();
  if (purchaseError || !purchase || purchase.status !== "paid") throw new Error("Paid lifetime purchase not durably verified");
  if (conversion.payment_intent_id && conversion.payment_intent_id !== input.paymentIntentId) throw new Error("Payment identity mismatch");
  if (conversion.checkout_session_id && conversion.checkout_session_id !== input.sessionId) throw new Error("Session identity mismatch");
  const prior = conversion.status;
  if (prior === "renewals_stopped") return { completed: true, alreadyCompleted: true };
  const paid = await admin.rpc("mark_lifetime_conversion_paid", { p_intent_id: input.intentId, p_session_id: input.sessionId, p_payment_intent_id: input.paymentIntentId });
  if (paid.error || paid.data !== true) throw new Error("Conversion payment fence failed");
  const sub = await stripe.subscriptions.retrieve(conversion.subscription_id, {}, { timeout: 10_000 });
  const snap = conversion.subscription_snapshot as Record<string, unknown>;
  const item = sub.items.data.length === 1 ? sub.items.data[0] : null;
  const priceId = item ? idOf(item.price) : null;
  const banks = selectedBanks(sub);
  if (sub.id !== conversion.subscription_id || idOf(sub.customer) !== input.customerId || sub.metadata?.user_id !== input.userId ||
      item?.id !== snap.itemId || priceId !== snap.priceId || item?.quantity !== snap.quantity || sub.metadata?.product_id !== snap.productId ||
      !sameSet(banks, snap.selectedBankIds) || !["active", "trialing", "canceled"].includes(sub.status) || sub.schedule != null || sub.pending_update != null) throw new Error("Subscription no longer matches stored conversion snapshot");
  if (sub.status !== "canceled" && !sub.cancel_at_period_end) {
    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true }, { idempotencyKey: `ppp-lifetime-stop-${input.intentId}`, timeout: 10_000 });
  }
  const fresh = await stripe.subscriptions.retrieve(sub.id, {}, { timeout: 10_000 });
  const freshItem = fresh.items.data.length === 1 ? fresh.items.data[0] : null;
  if (idOf(fresh.customer) !== input.customerId || fresh.metadata?.user_id !== input.userId || !freshItem || freshItem.id !== snap.itemId || idOf(freshItem.price) !== snap.priceId || freshItem.quantity !== snap.quantity ||
      fresh.metadata?.product_id !== snap.productId || !sameSet(selectedBanks(fresh), snap.selectedBankIds) ||
      !(fresh.cancel_at_period_end || fresh.status === "canceled")) throw new Error("Subscription cancellation readback mismatch");
  const complete = await admin.rpc("complete_lifetime_conversion", { p_intent_id: input.intentId, p_session_id: input.sessionId, p_payment_intent_id: input.paymentIntentId });
  if (complete.error || complete.data !== true) throw new Error("Conversion completion fence failed");
  return { completed: true, alreadyCompleted: false };
}
