# PastPaperPrep

PastPaperPrep is an image-first practice platform for Cambridge IGCSE Mathematics 0580 and IB Mathematics AA SL/HL. The production application serves normalized question metadata from this private repository and delivers premium question/mark-scheme WebPs through short-lived Supabase Storage signed URLs.

## Current corpus

- 6,479 questions
- 544 papers
- 15,474 private WebP assets
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