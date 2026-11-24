# IB Business Management HL and SL: release receipt (23 November 2026)

The owner approved the private R2 upload and the free-bucket copy. The billing migration was applied to production with owner approval (24 November 2026).

## Source
- Workspace: `ib-business-management-topic-practice` at commit a7221b2 (local git; review fixes of 2026-11-24 add accessible case text and per-question markband pages; crops and labels byte-identical to 817b319).
- Papers: IB Docs and papers.xtremepape.rs, November 2020 to May 2026.
- Held: Nov 2025 Paper 2 SL TZ1. Its question paper is missing, so no question, paper or crop of it appears in either bank.
- Rights: user-attested (`user_attested_rights_authorized`).
- Free years: 2020 and 2021 (Nov 2020, May 2021, Nov 2021). Paper 3 (social enterprise case) is HL only; the joint 2024+ Paper 1 serves in both banks.

## Banks
| Bank | Questions | Papers | Crops | Bytes | Candidate | Finalized runtime |
|---|---:|---:|---:|---:|---|---|
| ib-business-management-hl | 260 | 49 | 1,277 | 42,154,786 | `80144c77…` | `c7c257ba01fa9817859bf984662b9727f9f0ce946e2ac8b1f462b675ea066591` |
| ib-business-management-sl | 218 | 41 | 1,015 | 32,265,254 | `8de7e465…` | `872ea8b015363bd5b894ff2d04a81433df59d58c1641a367aa3dc66f70097aeb` |

Finalized content seals (`finalizedContentSha256`): HL `1476f433ecb0022ce3e001fd587e3e95b3ab5a37a9fcbebe6dab27163ea7df01`, SL `fa981fcedc0e921c628bb2caa736ecdb7f8b66d91f32c9a7598ae184cf09203a`.

## Private storage (bucket `pastpaperprep-assets`)
- Upload: create-only through a temporary Worker binding (R2 checks the SHA-256 on put), then each object read back and re-hashed. The Worker was deleted afterwards and confirmed gone (404).
- Results: 1,277 of 1,277 (HL) and 1,015 of 1,015 (SL) verified, 0 failed, 0 existed before.
- Logs: `docs/ib-business-management-{hl,sl}-r2-upload-log.jsonl`. Receipts: `data/storage/ib-business-management-{hl,sl}.receipt.json`.
- Log hashes: HL `f9db9b5e82b211091178ac0a0602230f71e1b4e1bd3091e9f4e9245f27ad323a`, SL `dd2018939bb6172453749b20f9fb223acf0a43cc1d615b92df47a8ef2eac8762`.
- Asset manifest hashes: HL `18fb17300b2dad2392598792e332533773a6acb192412cabaae1a0d943835789`, SL `478767c85bcd12932d55b5171f22d08a372a9932b35ca3279e0f5b7f47ee3963`.
- Runtimes were finalized with `node scripts/generate-igcse-release.mjs --finalize <bank>`; `pendingStorage` is removed from both catalog entries.

## Free bucket (`free.pastpaperprep.com`)
- 246 of 246 free-year crops copied and verified by a public fetch re-hash (HL 131, SL 115), 0 failed. The copy Worker was deleted and confirmed gone.
- Copy log SHA-256 `57759771277b7bf1eda09e8e5e80796b807336baad9b521f4eb42a5a55b49e1c`; verify log SHA-256 `5e93706da374c30f840dc8af17466ec10c603bcdb7a1c760bee06c9d4d76c8f2`.
- No free object is shared with a paid question.

## Billing migration
- `supabase/migrations/20261123000000_ib_business_management_release.sql` (SHA-256 `f89007eb…2889`) was applied to production on 24 November 2026, with owner approval, through the linked Supabase CLI (`db query --linked`).
  - Production was on 20261122000000 beforehand, the definitions this migration copies.
  - `migration repair` needs the file in the linked checkout, so the history row was inserted directly instead (`version 20261123000000`, `name ib_business_management_release`).
- Read back from production:
  - `schema_migrations` contains `20261123000000 ib_business_management_release`;
  - `bank_ib_business_management_hl` and `bank_ib_business_management_sl` are active;
  - each has 3 `stripe_price_catalog` rows, identical to the 3 generic `bank_igcse` rows;
  - `is_valid_custom_bank_ids` accepts both slugs and rejects an unknown one.
- The production `schema_migrations` row has `statements = NULL`, because it was recorded by a direct insert and not by `migration repair`. It proves only the version and name, not the SQL that ran.
  - The reviewer independently checked the four live function bodies and the five constraints against the migration file. That check, not the history row, is the evidence that the file's definitions are what production runs.
  - The SQL file was not changed after it was applied.
- No Stripe object was created or changed.

## Review fixes (24 November 2026)
- The source was re-pinned to `a7221b2`, which adds accessible case and resource text and per-question markband pages. Crops and labels are byte-identical to `817b319`.
- Both runtimes were regenerated and repinned to new candidate seals.
- Both receipts were re-sealed offline to the regenerated manifests from the **unchanged** upload logs (same log SHA-256, same 1,277 / 1,015 keys, every row re-checked against the manifest's key, hash and size). Then both runtimes were re-finalized.
- No object was uploaded, replaced or deleted. The free-year set is unchanged at 246 paths, all already copied.
