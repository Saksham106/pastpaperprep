# PastPaperPrep

PastPaperPrep is an image-first practice platform for Cambridge IGCSE Mathematics and IB Mathematics, Chemistry, Physics, and Biology. The production application serves normalized question metadata from this private repository. Premium question and mark-scheme WebPs use short-lived Cloudflare R2 signed URLs; free preview assets use short-lived Supabase Storage signed URLs.

## Current corpus

- 12,332 questions
- 853 papers
- 31,697 private WebP assets
- Reviewed free-year coverage per bank; PDF exports remain part of paid access

## Operator documentation

- [Content ingestion runbook](docs/content-ingestion.md) — acquire papers, build crops, classify questions, validate banks, import metadata, upload assets, recover interrupted runs, and evaluate OCR/layout tools.
- [Launch and infrastructure setup](docs/launch-setup.md) — Supabase, authentication, private delivery, billing, entitlements, and deployment controls.

## Development

```bash
npm install
npm run dev
```

Verification:

```bash
npm run test
npm run lint
npm run build
```

Local configuration belongs in ignored environment files. Never commit raw source PDFs, provider credentials, or Supabase secret keys.