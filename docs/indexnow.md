# IndexNow deployment

The GitHub Actions workflow compares the **live canonical sitemap** with the last successful sitemap snapshot after Vercel reports the pushed main revision successful. It submits only newly listed URLs and entries whose sitemap `lastmod` changed, plus sitemap removals. For non-article pages without `lastmod`, changed content that does not add/remove a sitemap URL is intentionally not inferred; add correct `lastmod` metadata if those pages need content-sensitive notifications. It does not crawl, index, or submit every URL on every deployment.

## One-time setup (maintainer)

1. Generate a random 32-character lowercase hexadecimal IndexNow key locally, e.g. `node -e 'console.log(require("node:crypto").randomBytes(16).toString("hex"))'`. This is an IndexNow verification key, **not** an account credential. Keep it out of chat, commits, and logs.
2. Add the key as the GitHub Actions repository secret `INDEXNOW_KEY` and set repository variable `INDEXNOW_KEY_FILE` to exactly `<key>.txt`.
3. Publish `public/<key>.txt` containing only the key (UTF-8 text). The workflow refuses submission unless the matching root URL responds publicly and its trimmed body equals the key. Deploy this key file before enabling the workflow.
4. Confirm GitHub Actions is enabled and Vercel reports successful commit statuses. The workflow intentionally waits up to 30 minutes for the exact main SHA status; it fails closed on failed or missing deployment status.

A missing cached baseline causes a **baseline-only run**: it snapshots the existing canonical sitemap and sends nothing. Thus enabling IndexNow does not trigger a URL blast. Subsequent successful workflow runs update the snapshot only after successful submissions (or when no URLs changed). Delivery JSONL is uploaded as a 90-day Actions artifact. Failed submissions retain the old snapshot for retry. Actions cache entries are immutable and keyed by commit SHA; the serial concurrency group restores the most recent prior state.

## Safety and limits

The notifier accepts only `https://pastpaperprep.com` URLs in the sitemap. It rejects query strings, fragments, noncanonical trailing slashes, APIs, account/private paths, and unknown routes; article URLs must be one slug segment. It does not use sitemap `lastmod` as authority to permit URLs outside this allowlist. The key is sent only to the IndexNow service and used in a private GitHub secret; the public verification file necessarily contains the public protocol key. HTTP 200/202 means accepted/received, **not indexed**. Batches above the documented 10,000 URL limit are refused.

## Local safe check

`node scripts/indexnow.mjs` reads the public sitemap and either initializes a local baseline or prints a dry-run diff; it never submits. State/log files live under ignored `.indexnow/`. Do not use `--submit` locally. Official protocol details: <https://www.indexnow.org/documentation>.
