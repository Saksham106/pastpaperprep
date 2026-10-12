# Email-code and Google auth rollout

## Provider readiness

The production project `wrigscheuwsooyvayclz` has email confirmation and Google enabled. Its email OTP policy was read back as **8 digits / 3,600 seconds**. Those settings were not changed.

An interim version of `supabase/templates/confirm-sign-up.html` and `magic-link.html` was installed with owner authorization before the app shipped code entry; it added a conditional "if your sign-in screen offers code entry" sentence. The repository templates drop that sentence and must be pushed to Supabase (owner approval) after the app deploy. Subjects stay unchanged.

The emails preserve the existing scanner-safe `.RedirectTo` + `.TokenHash` link and token type, and also expose `.Token` in the preheader and a tap-to-select box. Code fallback cannot recover mail that never reaches the recipient.

## Application gate

Keep the PR open and auto-merge off until approved. Before an approved deployment, require the final exact-head test/lint/type/build/privacy gates, independent auth/UI review, and CI/preview readback. Preserve POST-only email confirmation and its 303 response, safe internal return paths and the pinned password-recovery destination.

Do not count a Google chooser or enabled-provider toggle as a completed login. A live QA pass must establish the session and land on the intended safe path using an approved owned identity without replacing the owner's unrelated session. Preview OAuth needs its callback and PKCE cookies on the same approved origin; canonical `NEXT_PUBLIC_SITE_URL` alone does not prove preview roundtrip behavior. Do not widen redirect allowlists or enable experimental SDK redirect augmentation merely to make a preview pass.

## Operational safeguards

- Inspect current template bodies and OTP policy before changing them again; preserve source/hash readback and rollback copies in private operator evidence.
- Preserve synchronous client guards and one shared check-email operation boundary across code verification, resend and recipient switches.
- Treat successful token/session establishment as separate from best-effort referral/analytics work; ancillary failures must not require replaying a consumed OTP.
- Log only opaque attempt IDs, fixed phases/outcomes and allowlisted provider codes. New phases must be accepted by the downstream exception sink too.
- Typed-code signup conversion uses the provider's confirmation-token verification boundary rather than a client form label. Supabase supports token-family aliases: invite confirmation codes can satisfy signup verification, and recovery codes can satisfy the combined email fallback. Do not describe these as strictly isolated provider flows. The existing Google first-signup classifier remains a two-minute provider-timestamp heuristic with stable event-key deduplication, not a new authoritative event ledger.
- Explicit Google flows carry their own PKCE flow ID. Legacy callbacks and recovery starts retain their existing latest-verifier behavior; this is not a claim that all concurrent recovery starts are isolated.
