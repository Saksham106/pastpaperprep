# IndexNow

The main-branch GitHub workflow runs after publication and daily as a catch-up. It waits for the latest exact `Vercel` commit status to succeed and stops if that revision is no longer main. No paid service or account secret is required. `public/key.txt` is a public protocol verification token, checked against its deployed root URL before any submission.

The notifier parses the live sitemap with Python standard-library XML parsing. It fetches only allowlisted canonical public pages, with four concurrent requests, and snapshots sitemap lastmod plus hashes of the public main text/title/description. Scripts, build IDs and personalized header/footer are excluded. This detects edits to undated public pages too. It submits only additions, changed content/lastmod, and previously-public deletions; not every sitemap URL on every deploy. This is bounded HTML change detection, not a complete image-only or JavaScript-behavior change detector.

State is cached between successful runs under unique run/attempt keys. Failed HTTP submissions preserve the baseline; retries remain possible. First run snapshots without sending anything. Every completed comparison writes a receipt, uploaded as a 90-day artifact. If the cache expires, the next run deliberately re-baselines rather than blasting all URLs. Daily catch-up avoids losing subsequent undated edits.

`node scripts/indexnow.mjs` is a safe dry run. `--submit` sends the detected changes. An operator may use `--urls file.json --submit` for an initial bounded list of recently published/updated URLs; explicit URLs must also be in the current public sitemap and maximum 1,000. A batch over 10,000 fails closed. Private/query/fragment/foreign-host URLs are rejected. Python 3 and Node 22+ are required; Actions installs both. Local ARM hosts may set `INDEXNOW_PYTHON` to their native interpreter.

HTTP200/202 means accepted/received, **not indexed**. Verify live key and actual delivery receipts after deployment. Official protocol: https://www.indexnow.org/documentation.
