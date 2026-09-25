import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { readEditableCurrentPlan, resolveAccountPlanTarget } from "@/lib/account-plan-target";
import { buildAccountPlanSchedulePhases } from "@/lib/account-plan-schedule";
import { recurringPriceSubtotal } from "@/lib/account-billing-view";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
class Conflict extends Error {}
const customerOf = (x: string | { id: string }) => typeof x === "string" ? x : x.id;
const sameMetadata = (actual: Record<string, string> | null | undefined, expected: Record<string, string>) =>
  !!actual && JSON.stringify(Object.entries(actual).sort(([a], [b]) => a.localeCompare(b))) === JSON.stringify(Object.entries(expected).sort(([a], [b]) => a.localeCompare(b)));
const priceId = (price: string | { id: string }) => typeof price === "string" ? price : price.id;
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origin not allowed" }, 403);
  if (process.env.STRIPE_PLAN_EDITOR_ENABLED !== "true") return json({ error: "Plan scheduling is unavailable" }, 404);
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Authentication required" }, 401);
  if (!isStripeBillingEnabled()) return json({ error: "Billing is not available" }, 503);
  let body: {intent?:unknown;selectedBankIds?:unknown;allAccess?:unknown;interval?:unknown;scheduleId?:unknown;snapshot?:unknown};
  try { body = await request.json(); } catch { return json({error:"Invalid JSON"},400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || (body.intent !== "preview" && body.intent !== "create" && body.intent !== "undo")) return json({error:"Invalid schedule intent"},400);
  if ((body.intent === "preview" || body.intent === "create") && (!Array.isArray(body.selectedBankIds) || typeof body.allAccess !== "boolean" || !["monthly","annual"].includes(body.interval as string))) return json({error:"Invalid plan selection"},400);
  if (body.intent === "undo" && (typeof body.scheduleId !== "string" || !body.scheduleId)) return json({error:"Invalid schedule identifier"},400);
  const admin = createAdminClient(), intentId = randomUUID(); let held = false, providerAttempted = false;
  try {
    const r = await admin.rpc("reserve_billing_checkout", {p_user_id:user.id,p_intent_id:intentId}); if (r.error) throw r.error; if (r.data !== true) throw new Conflict("Another billing operation is in progress"); held = true;
    const c = await admin.rpc("get_stripe_customer_id",{p_user_id:user.id}); if (c.error) throw c.error; if (typeof c.data !== "string" || !c.data) throw new Conflict("No billing account found");
    const config = getStripeConfig(), stripe = createStripeClient(config.secretKey);
    const listed = await stripe.subscriptions.list({customer:c.data,status:"all",limit:100});
    if (listed.has_more || listed.data.some(s => customerOf(s.customer) !== c.data || s.metadata?.user_id !== user.id)) throw new Conflict("Stripe billing owner mismatch");
    const active = listed.data.filter(s => s.status === "active"); if (active.length !== 1 || listed.data.some(s => !["active","canceled","incomplete_expired"].includes(s.status))) throw new Conflict("Exactly one active subscription is required");
    const sub = active[0]; if (sub.metadata?.user_id !== user.id || customerOf(sub.customer) !== c.data || sub.pending_update || sub.cancel_at_period_end || sub.cancel_at != null) throw new Conflict("Subscription is not eligible for scheduling");
    const [sessions,invoices] = await Promise.all([stripe.checkout.sessions.list({customer:c.data,status:"open",limit:100}),stripe.invoices.list({customer:c.data,status:"open",limit:100})]);
    if (sessions.has_more || sessions.data.length) throw new Conflict("Resolve open Checkout sessions first"); if (invoices.has_more || invoices.data.length) throw new Conflict("Resolve open invoices first");
    if (body.intent === "undo") {
      if (!sub.schedule || (typeof sub.schedule === "string" ? sub.schedule : sub.schedule.id) !== body.scheduleId) throw new Conflict("Schedule does not belong to this subscription");
      const sched = await stripe.subscriptionSchedules.retrieve(body.scheduleId as string), md = sched.metadata;
      if (sched.subscription !== sub.id || md?.owner !== "pastpaperprep" || md.user_id !== user.id || md.subscription_id !== sub.id || !/^[0-9a-f-]{36}$/i.test(md.ownership_id ?? "") || sched.status !== "active" || sched.current_phase?.start_date !== sched.phases[0]?.start_date) throw new Conflict("Only an app-owned phase-zero schedule can be undone");
      const before = {items:sub.items.data.map(i=>({id:i.id,price:typeof i.price === "string"?i.price:i.price.id,quantity:i.quantity})),metadata:{...sub.metadata},end:sub.items.data[0]?.current_period_end};
      providerAttempted = true; await stripe.subscriptionSchedules.release(body.scheduleId as string,{}, {idempotencyKey:`pastpaperprep-schedule-undo-${intentId}`,timeout:30000});
      const [after,released] = await Promise.all([stripe.subscriptions.retrieve(sub.id),stripe.subscriptionSchedules.retrieve(body.scheduleId as string)]);
      const state = {items:after.items.data.map(i=>({id:i.id,price:typeof i.price === "string"?i.price:i.price.id,quantity:i.quantity})),metadata:{...after.metadata},end:after.items.data[0]?.current_period_end};
      if (after.schedule || after.pending_update || after.status !== "active" || customerOf(after.customer)!==c.data || JSON.stringify(state)!==JSON.stringify(before) ||
        released.id!==body.scheduleId || released.status!=="released" || released.current_phase!==null || released.subscription!==null ||
        !sameMetadata(released.metadata,md)) throw new Error("Schedule release readback mismatch");
      const done=await admin.rpc("release_billing_checkout",{p_user_id:user.id,p_intent_id:intentId}); if(done.error||done.data!==true) throw new Error("Billing reservation release failed"); held=false; return json({status:"released"});
    }
    if (sub.schedule) throw new Conflict("Subscription already has a schedule"); if (sub.items.data.length!==1) throw new Conflict("Expected exactly one subscription item");
    const current=readEditableCurrentPlan(sub,config), target=resolveAccountPlanTarget({selectedBankIds:body.selectedBankIds,allAccess:body.allAccess,interval:body.interval},config), item=sub.items.data[0];
    if (current.interval === target.interval && current.productId === target.productId &&
      JSON.stringify(current.selectedBankIds ?? []) === JSON.stringify(target.selectedBankIds ?? [])) throw new Conflict("Your selected plan is already active");
    const start=item.current_period_start,end=item.current_period_end;
    if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=Math.floor(Date.now()/1000)||typeof item.price==="string"||item.price.recurring?.interval_count!==1) throw new Conflict("Subscription period or recurrence is unsupported");
    const catalog=await admin.rpc("get_checkout_price_catalog",{p_price_id:target.priceId}); if(catalog.error) throw catalog.error;
    const matches = Array.isArray(catalog.data) ? catalog.data.filter((x: { price_id?: string; product_id?: string; billing_interval?: string; active?: boolean; grandfathered?: boolean }) =>
      x.price_id === target.priceId && x.product_id === target.productId && x.billing_interval === target.interval && x.active === true && x.grandfathered === false) : [];
    if(matches.length !== 1) throw new Conflict("Target price is not an active standard plan");
    const targetPrice = await stripe.prices.retrieve(target.priceId, { expand: ["tiers"] });
    const recurringSubtotalCents = recurringPriceSubtotal(targetPrice, target.quantity);
    if (targetPrice.id !== target.priceId || !targetPrice.active || targetPrice.currency !== "usd" || targetPrice.recurring?.interval !== (target.interval === "monthly" ? "month" : "year") ||
      targetPrice.recurring?.interval_count !== 1 || recurringSubtotalCents === null || recurringSubtotalCents < 0) throw new Conflict("Target recurring rate is unavailable");
    const snapshot={subscriptionId:sub.id,currentPeriodStart:start,currentPeriodEnd:end,currentPriceId:current.priceId,currentQuantity:item.quantity,currentProductId:current.productId,currentSelectedBankIds:current.selectedBankIds??[],currentInterval:current.interval,targetPriceId:target.priceId,quantity:target.quantity,recurringSubtotalCents,selectedBankIds:target.selectedBankIds??[],allAccess:target.productId==="bundle_all",interval:target.interval};
    if(body.intent==="preview") {
      const done=await admin.rpc("release_billing_checkout",{p_user_id:user.id,p_intent_id:intentId}); if(done.error||done.data!==true) throw new Error("Billing reservation release failed");
      held=false; return json({status:"preview",snapshot:{...snapshot,quotedAt:Math.floor(Date.now()/1000)},effectiveAt:new Date(end*1000).toISOString(),currency:"usd"});
    }
    const provided=body.snapshot;
    if(!provided || typeof provided!=="object" || Array.isArray(provided)) throw new Conflict("Review a fresh renewal quote before confirming");
    const quote=provided as Record<string,unknown>,now=Math.floor(Date.now()/1000);
    if(!Number.isSafeInteger(quote.quotedAt) || typeof quote.quotedAt!=="number" || quote.quotedAt>now || now-quote.quotedAt>300 ||
      Object.entries(snapshot).some(([key,value])=>JSON.stringify(quote[key])!==JSON.stringify(value))) throw new Conflict("Renewal quote changed or expired. Review it again");
    const metadata={...sub.metadata,product_id:target.productId,selected_bank_ids:target.productId==="bundle_custom"?JSON.stringify(target.selectedBankIds??[]):"",billing_interval:target.interval,price_id:target.priceId};
    const phases=buildAccountPlanSchedulePhases({currentStart:start as number,currentEnd:end as number,currentPriceId:current.priceId,currentQuantity:item.quantity??0,currentMetadata:sub.metadata,target,targetMetadata:metadata});
    providerAttempted=true; const created=await stripe.subscriptionSchedules.create({from_subscription:sub.id},{idempotencyKey:`pastpaperprep-schedule-create-${intentId}`,timeout:30000});
    const owner={owner:"pastpaperprep",user_id:user.id,subscription_id:sub.id,ownership_id:randomUUID()};
    await stripe.subscriptionSchedules.update(created.id,{end_behavior:"release",metadata:owner,proration_behavior:"none",phases:[phases[0],{...phases[1],duration:{interval:target.interval==="monthly"?"month":"year",interval_count:1},proration_behavior:"none"}]},{idempotencyKey:`pastpaperprep-schedule-update-${intentId}`,timeout:30000});
    const [verified,attached]=await Promise.all([stripe.subscriptionSchedules.retrieve(created.id),stripe.subscriptions.retrieve(sub.id)]);
    const [first,second] = verified.phases;
    const sameItem = (phase: typeof first | undefined, wanted: typeof phases[number]) => phase?.items.length === 1 &&
      priceId(phase.items[0].price) === wanted.items[0].price && phase.items[0].quantity === wanted.items[0].quantity;
    const attachedItem = attached.items.data.length === 1 ? attached.items.data[0] : null;
    if(verified.id !== created.id || customerOf(verified.customer) !== c.data || verified.subscription!==sub.id || verified.status!=="active" || verified.end_behavior!=="release" ||
      !sameMetadata(verified.metadata,owner) || verified.phases.length!==2 || verified.current_phase?.start_date!==start || verified.current_phase?.end_date!==end ||
      first?.start_date!==start || first.end_date!==end || !sameItem(first,phases[0]) || !sameMetadata(first.metadata,phases[0].metadata) ||
      second?.start_date!==end || !second.end_date || second.end_date<=end || !sameItem(second,phases[1]) || !sameMetadata(second.metadata,phases[1].metadata) ||
      (typeof attached.schedule==="string"?attached.schedule:attached.schedule?.id)!==created.id || attached.pending_update || attached.status!=="active" ||
      customerOf(attached.customer)!==c.data || attached.metadata.user_id!==user.id || !sameMetadata(attached.metadata,sub.metadata) ||
      !attachedItem || attachedItem.id!==item.id || priceId(attachedItem.price)!==current.priceId || attachedItem.quantity!==item.quantity ||
      attachedItem.current_period_start!==start || attachedItem.current_period_end!==end) throw new Error("Schedule update readback mismatch");
    const done=await admin.rpc("release_billing_checkout",{p_user_id:user.id,p_intent_id:intentId}); if(done.error||done.data!==true) throw new Error("Billing reservation release failed"); held=false; return json({status:"scheduled",scheduleId:created.id,effectiveAt:new Date((end as number)*1000).toISOString()});
  } catch(error) {
    if(held&&!providerAttempted){const x=await admin.rpc("release_billing_checkout",{p_user_id:user.id,p_intent_id:intentId});if(x.error)console.error("Billing reservation cleanup failed");held=false;}
    if(error instanceof Conflict||error instanceof Error&&["Unsupported billing interval","Invalid plan selection","Unknown bank","Duplicate bank","Bank is unavailable","Select at least one bank","Subscription is not editable","Expected exactly one subscription item","Subscription price is not currently editable"].includes(error.message)) return json({error:error.message},409);
    console.error("Stripe subscription schedule failed",error instanceof Error?{name:error.name,message:error.message}:{type:typeof error}); return json({error:"Subscription scheduling is temporarily unavailable"},503);
  }
}
