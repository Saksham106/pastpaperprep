# Failed-renewal notice: receipt (2026-11-26)

Screenshots from `npm run preview:agent`. The browser had a placeholder session cookie and `/api/billing/payment-notice` was stubbed in the page, so the header shows "Log in" and the dashboard shows the free plan. Only the notice itself is real.

- `1-bank-desktop-light-grace.jpg`: bank page, still inside the 14-day grace
- `2-dashboard-desktop-dark-ended.jpg`: dashboard, dark theme, access already stopped
- `3-pricing-mobile-light-grace.jpg`: pricing at 375 px, with the "New plans unlock once it's paid" line (no horizontal overflow)

Live Stripe, read-only, aggregates only: 2 subscriptions past_due ($20 open in total, both inside the grace, retries scheduled), 0 unpaid, 60 active. Of 12 renewal invoices in the last 30 days, 3 failed (2 still open, 1 void) and none have been recovered yet.
