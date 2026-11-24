# IB Business Management HL and SL: release receipt (23 November 2026)

The owner approved the private R2 upload and the free-bucket copy. The billing migration was applied to production with owner approval (24 November 2026).

## Source
- Workspace: `ib-business-management-topic-practice` at commit 817b319 (local git).
- Papers: IB Docs and papers.xtremepape.rs, November 2020 to May 2026.
- Held: Nov 2025 Paper 2 SL TZ1. Its question paper is missing, so no question, paper or crop of it appears in either bank.
- Rights: user-attested (`user_attested_rights_authorized`).
- Free years: 2020 and 2021 (Nov 2020, May 2021, Nov 2021). Paper 3 (social enterprise case) is HL only; the joint 2024+ Paper 1 serves in both banks.

## Banks
| Bank | Questions | Papers | Crops | Bytes | Candidate | Finalized runtime |
|---|---:|---:|---:|---:|---|---|
| ib-business-management-hl | 260 | 49 | 1,277 | 42,154,786 | `4ff98d61…` | `e0709f5d58267f22a2f7b434ae81956efebb247327d2077a6c85dac63d99dc35` |
| ib-business-management-sl | 218 | 41 | 1,015 | 32,265,254 | `ada0f6fa…` | `0b8ca88c867fb9234f1e3199f6dd4788de6d309aabcdae9ad6d5504e8fb8999a` |

Finalized content seals (`finalizedContentSha256`): HL `56eb5ff6ac64b37942c9d3b18e75936f8328881ed9a112d7fb3cbb0187cca699`, SL `767b6c6bffcfd63105e9f398c346b3eb332a693541112645f17506341e73c94f`.

## Private storage (bucket `pastpaperprep-assets`)
- Upload: create-only through a temporary Worker binding (R2 checks the SHA-256 on put), then each object read back and re-hashed. The Worker was deleted afterwards and confirmed gone (404).
- Results: 1,277 of 1,277 (HL) and 1,015 of 1,015 (SL) verified, 0 failed, 0 existed before.
- Logs: `docs/ib-business-management-{hl,sl}-r2-upload-log.jsonl`. Receipts: `data/storage/ib-business-management-{hl,sl}.receipt.json`.
- Log hashes: HL `f9db9b5e82b211091178ac0a0602230f71e1b4e1bd3091e9f4e9245f27ad323a`, SL `dd2018939bb6172453749b20f9fb223acf0a43cc1d615b92df47a8ef2eac8762`.
- Asset manifest hashes: HL `fade7524764d0da5d2f09504e22e41f6c2b4bf05dc732b6776eaa908ded5b4b0`, SL `2227ba80db8ad0dfdcab0098b5c15cd2f2741f9f37c1563b4c5118b8a4820a6e`.
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
