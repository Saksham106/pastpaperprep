# Failed-renewal notice: receipt (2026-11-26)

Screenshots from `npm run preview:agent`. The browser had a placeholder session cookie and `/api/billing/payment-notice` was stubbed in the page, so the header shows "Log in" and the dashboard shows the free plan. Only the notice itself is real.

- `1-bank-desktop-light-grace.jpg`: bank page, still inside the 14-day grace
- `2-dashboard-desktop-dark-ended.jpg`: dashboard, dark theme, access already stopped
- `4-pricing-desktop-banner-v2.jpg`: pricing banner, "Pay by … to keep access and change your plan"
- `5-pricing-lifetime-pay-first.jpg`: a blocked purchase (here Lifetime) now shows one step, Pay now, instead of a disabled checkout button and a portal link. Checkout and plan changes show the same step.

The 375 px check (no horizontal overflow) was done on the first version of the pricing banner, before the copy change.

Live Stripe, read-only, aggregates only: 2 subscriptions past_due ($20 open in total, both inside the grace, retries scheduled), 0 unpaid, 60 active. Of 12 renewal invoices in the last 30 days, 3 failed (2 still open, 1 void) and none have been recovered yet.
