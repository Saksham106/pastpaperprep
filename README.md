# PastPaperPrep

PastPaperPrep is an image-first practice platform for Cambridge IGCSE and IB past-paper questions. The application serves normalized question metadata from this repository. Premium question and mark-scheme WebPs use short-lived Cloudflare R2 signed URLs; free preview assets use short-lived Supabase Storage signed URLs.

## Current corpus

About 40,000 questions across 19 banks (counts from the generated bank index):

- **Cambridge IGCSE:** Mathematics 0580, Additional Mathematics 0606, Biology 0610, Chemistry 0620, Physics 0625, Co-ordinated Sciences 0654, Economics 0455
- **IB:** Mathematics AA HL/SL, Mathematics AI HL/SL, Chemistry HL/SL, Physics HL/SL, Biology HL/SL, Economics HL/SL

Reviewed free-year coverage is available per bank; PDF exports remain part of paid access.

## Operator documentation

- [Content ingestion runbook](docs/content-ingestion.md) — acquire papers, build crops, classify questions, validate banks, import metadata, upload assets, recover interrupted runs, and evaluate OCR/layout tools.
- [Launch and infrastructure setup](docs/launch-setup.md) — Supabase, authentication, private delivery, billing, entitlements, and deployment controls.
- [Pricing strategy](docs/pricing-strategy.md), [IndexNow](docs/indexnow.md), [Referrals](docs/referrals.md).
- Most other files in `docs/` are dated release receipts and audit evidence; several tests read them, so move or delete them only together with those tests.

## Development

```bash
npm install
npm run dev
```

Verification (CI runs the first three on every pull request):

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` goes through `scripts/next-build.mjs`, which sets the heap budget that works both on Vercel and on stock Node.

Local configuration belongs in ignored environment files (see `.env.example`). Never commit raw source PDFs, provider credentials, or Supabase secret keys.
