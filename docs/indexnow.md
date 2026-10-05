# IndexNow deployment

The GitHub Actions workflow compares the **live canonical sitemap** with the last successful sitemap snapshot after Vercel reports the pushed main revision successful. It submits only newly listed URLs and entries whose sitemap `lastmod` changed, plus sitemap removals. For non-article pages without `lastmod`, changed content that does not add/remove a sitemap URL is intentionally not inferred; add correct `lastmod` metadata if those pages need content-sensitive notifications. It does not crawl, index, or submit every URL on every deployment.

## One-time setup

A random 32-character lowercase hexadecimal protocol key is committed at `public/key.txt`. IndexNow keys are public verification tokens, not account credentials or secrets; no GitHub secret or variable is required. The script reads the key from this file and verifies that its deployed root URL serves the same value before submitting. Deploy the file before enabling notifications.

The workflow waits for the Vercel status for the pushed revision and compares the live canonical sitemap to its prior snapshot. The first run initializes a baseline only. `--urls <json-file>` supports a bounded explicit initial URL list (maximum 1,000) for a deliberate post-deployment first notification. Sitemap additions/removals and lastmod updates remain the recurring notification source. Artifacts include delivery receipts; HTTP 200/202 is accepted by IndexNow, not proof of indexing.

Only canonical allowlisted public routes are submitted; URLs with query strings, fragments, or noncanonical trailing slashes are rejected. Batches above 10,000 are refused. Do not submit private/account routes.

## Local safe check

`node scripts/indexnow.mjs` reads the public sitemap and either initializes a local baseline or prints a dry-run diff; it never submits. State/log files live under ignored `.indexnow/`. Do not use `--submit` locally. Official protocol details: <https://www.indexnow.org/documentation>.
