# Customer referrals — low-volume manual pilot

This is **not** Pietro's `/r/pietro` tutor commission. No Stripe checkout, webhook, or entitlement code is modified for this pilot. Account → Referrals generates a stable `https://pastpaperprep.com/invite/c_<24 hex>` link. The redirect signs the existing first-touch, HttpOnly, Secure, SameSite=Lax referral cookie for 30 days; a pre-existing valid tutor or customer click wins. Anonymous clicks are not recorded. Signup confirmation binds the code to a genuinely new, email-confirmed Supabase user ID. The page shows only the inviter's verified-signup count, progress toward the next five-signup milestone, and **awards already recorded after fulfillment**. It does not show click, friend, or purchase counts. A referred purchase and any billing credit must be reviewed and granted manually.

## Deployment gate

1. Review cookie/privacy disclosure and establish an appropriate legal basis/consent handling **before broad public promotion**. The existing `/privacy` notice for the tutor cookie is not a legal conclusion. This pilot adds a new use of the cookie.
2. Apply `20260926000005_customer_referral_pilot.sql` to the intended Supabase project **before** deploying the app route. Inspect migration history and read back the exact schema, RLS, RPC EXECUTE grants, and the preserved tutor binder. The link RPC derives its owner from the authenticated JWT; table reads and binding are service-only. Verify the operator's ability to read records separately from a customer's inability to enumerate them. Also read back the deployed ACLs of the existing `referral_monthly_payout_report` and `mark_referral_payout` functions before and after migration; `CREATE OR REPLACE FUNCTION` preserves existing privileges but does not repair a previously unsafe grant.
3. After deployment, test a real link → new confirmed account → one attribution → one signup count with a disposable account, plus existing-account, self-referral, partner-first and customer-first exclusions. No live purchase is required. Do not publicly claim live payment tracking; that is a manual operator task.
4. Test the proposed manual bill-credit mechanism with isolated **Stripe test-mode** subscriptions (monthly, annual, grandfathered, multiple subscriptions, taxes, existing discounts, zero-due renewal, refunds) before granting any live credit. Never submit full card numbers to Stripe's API. A credit may land on the wrong invoice if applied as an unrestricted customer balance.

## Operator review (Supabase SQL editor, read-only)

List attributed accounts without revealing friend data in the inviter UI:

```sql
select a.referrer_user_id, a.user_id as referred_user_id, a.attributed_at,
       a.verified_at, sc.customer_id, ss.subscription_id, ss.status
from public.customer_referral_attributions a
left join public.stripe_customers sc on sc.user_id = a.user_id
left join public.stripe_subscriptions ss on ss.user_id = a.user_id
order by a.verified_at desc;
```

The presence of a Stripe customer or subscription **does not prove a qualifying purchase**. Open the mapped customer in Stripe and verify the **first collected subscription invoice**, succeeded payment, matching subscription/customer, nonzero cash paid, and no refund/dispute. Reject self-referrals, old accounts, partner-attributed accounts and recycled/abusive signups. For a signup milestone, count distinct eligible users per inviter and check the existing `customer_referral_awards` rows before fulfilling. Every five eligible verified signups creates one possible milestone (milestone_index 1, 2, ...), subject to review; an individual first paid purchase can qualify separately. Neither clicks nor renewals count.

Calculate a one-month-equivalent credit from the referrer's **actual plan price when earned**, not the invited person's purchase: monthly plan = that month's plan price; annual plan = annual price / 12, with documented cent rounding. For a free referrer, wait until they choose a paid plan and fix the amount then. Credit a specific eligible future bill manually, not a calendar extension or a second subscription. Check outstanding invoices, stacked subscriptions, existing discounts, currency, cancellation and residual credits before granting. Do not assume an unrestricted Stripe customer balance targets the intended renewal. A qualifying purchase that is later refunded needs individual review before granting or retaining a reward.

**After Stripe readback confirms the exact credit**, record one award in `customer_referral_awards` with the inviter UUID, either `five_signups` + its one-based `milestone_index` or `first_purchase` + the referred UUID, positive `amount_cents`, currency, and the real unique external Stripe credit/discount reference. Do not record a pending grant as awarded. A database trigger rejects signup milestones that lack five new verified users per milestone or skip ahead. Unique constraints prevent duplicate milestones, duplicate referred-purchase awards, and reuse of the same external grant reference. The composite FK prevents recording somebody else's referred user under this inviter. Keep the Stripe reference and invoice/transaction evidence in the operator review. Account deletion cascades the related link, attribution, and award rows; the Stripe credit itself and any separately retained payment records require their own retention review. This is a manual ledger, not an API endpoint.

## Limits

Attribution depends on the same browser retaining the first signed cookie until signup; switching devices or clearing cookies breaks the chain. The signup count includes technically verified unique new accounts, not a fraud guarantee. Purchases have no automatic count or purchase webhook in this pilot. No invited-friend bank trial is included; do not advertise one. No billing writes or test/live charges are performed by this app change.
