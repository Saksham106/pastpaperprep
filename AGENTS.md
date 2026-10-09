<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working on PastPaperPrep

Production (https://pastpaperprep.com) has paying customers. Vercel deploys `main` automatically.

## Before changing anything

- Read `README.md`, `docs/launch-setup.md`, and — when touching question content — `docs/content-ingestion.md`.
- Inspect Git state first (`git status`, current branch, `git worktree list`). Other agents work in this repository; the main checkout may not be on `main`, and the stash stack is shared.
- Work on a feature branch in its own worktree under `.worktrees/` (ignored). Never rewrite or discard someone else's branch, stash, or uncommitted changes.

## Stack and verification

Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase, Stripe, Cloudflare R2, PostHog; npm and Vitest.

Before opening a PR: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` must pass. CI runs lint, typecheck, and tests on every PR; Vercel builds a preview.

## Needs explicit owner approval

- Deploying, promoting, or rolling back production
- Changing live Stripe objects, prices, webhooks, or entitlements
- Running migrations against the production Supabase project
- Uploading, replacing, or deleting R2 / Supabase Storage objects
- Changing Vercel environment variables

## Content and secrets

- Keep source PDFs and premium question/mark-scheme images out of Git; they belong in R2 / Supabase Storage.
- Never commit `.env*` files (only `.env.example`), credentials, or generated Stripe catalog SQL.

## Layout

- `src/app/` pages and API routes; `src/components/` UI; `src/lib/` filtering, access, billing, worksheets, PDF export, integrations
- `src/data/raw/` and `src/data/production/` question-bank runtime data; `public/bank-index/` is generated (`npm run generate:bank-index`)
- `supabase/migrations/` schema; `scripts/` ingestion, index generation, storage tooling; `docs/` runbooks plus dated receipts

Sibling folders next to this repository are ingestion/source workspaces, not the deployed app — for example `../igcse-0580-topic-practice`, `../igcse-additional-mathematics-0606-topic-practice`, `../igcse-{biology-0610,chemistry-0620,physics-0625,coordinated-sciences-0654,economics-0455}-topic-practice`, `../ib-maths-aa-hl-topic-practice`, `../ib-{chemistry,physics,biology,economics}-topic-practice`, and `../research/`. Product work starts here. A few tests read sibling audit folders and skip themselves when those folders are absent.
