# PastPaperPrep launch setup

The product shell and all three question banks work locally without external services. Launch infrastructure is intentionally separate.

## 1. Supabase

Create a dedicated project named `pastpaperprep`. Do not reuse the Insight Academy project because this is a separate commercial product with different users, billing, and data ownership.

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Initial schema:

- `profiles`: user identity and display name
- `products`: IGCSE, IB HL, IB SL, all-access
- `entitlements`: which product each user can access and expiry state
- `attempts`: question, answer state, confidence, timestamps
- `bookmarks`: saved questions
- `stripe_customers`: Supabase user to Stripe customer mapping

Enable email magic-link login first. Add Google only after the core flow works. All user-scoped tables need Row Level Security before production.

## 2. Stripe

Use Saksham's business Stripe account. Create four products:

1. IGCSE Mathematics access
2. IB Math AA HL access
3. IB Math AA SL access
4. All-access bundle

Use Stripe Checkout rather than collecting card data directly. A verified webhook should update `entitlements`; never trust a browser redirect as proof of payment.

Required environment variables:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

Pricing can be decided later without blocking the build.

## 3. Question assets

The commercial repo stores normalized JSON. Images currently resolve from the source GitHub Pages sites to avoid putting more than 400 MB of media into the Vercel build.

Before public launch, migrate `questions/` and `markschemes/` into Supabase Storage or another CDN and update each bank's `sourceBaseUrl`. Keep the bucket public for question images only; do not store user data there.

## 4. Vercel and domain

1. Push this codebase to a new private GitHub repository.
2. Import it into Vercel.
3. Add production environment variables.
4. Deploy and verify all routes.
5. Buy `pastpaperprep.com` only after a final registrar availability check.
6. Point the domain to Vercel and make `www` redirect to the apex domain.
7. Add the production URL to Supabase Auth redirect allowlists and Stripe Checkout settings.

## 5. Release gate

Do not accept money until all are true:

- Sign-up, sign-in, sign-out, and passwordless recovery verified
- Checkout and cancellation verified in Stripe test mode
- Webhook replay/idempotency tested
- Entitlements enforced server-side
- Terms, Privacy, Refund Policy, and contact email published
- Question/image licensing record retained
- Mobile, keyboard, dark-mode, and accessibility checks pass
- Analytics and error monitoring enabled
