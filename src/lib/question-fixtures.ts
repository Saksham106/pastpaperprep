import igcseData from "@/data/raw/igcse.json";
import igcseAdditionalData from "@/data/raw/igcse-additional.json";
import ibHlData from "@/data/raw/ib-hl.json";
import ibSlData from "@/data/raw/ib-sl.json";
import ibAiHlData from "@/data/raw/ib-ai-hl.json";
import ibAiSlData from "@/data/raw/ib-ai-sl.json";
import ibChemistryHlData from "@/data/raw/ib-chemistry-hl.json";
import ibChemistrySlData from "@/data/raw/ib-chemistry-sl.json";
import type { BankSlug } from "@/lib/banks";
import { normalizeBankQuestions, type UnifiedQuestion } from "@/lib/questions";

type RawBank = { questions: Array<Record<string, unknown>> };
const rawBanks: Record<BankSlug, RawBank> = {
  igcse: igcseData as RawBank,
  "igcse-additional": igcseAdditionalData as RawBank,
  "ib-hl": ibHlData as RawBank,
  "ib-sl": ibSlData as RawBank,
  "ib-ai-hl": ibAiHlData as RawBank,
  "ib-ai-sl": ibAiSlData as RawBank,
  "ib-chemistry-hl": ibChemistryHlData as RawBank,
  "ib-chemistry-sl": ibChemistrySlData as RawBank,
};
const cache = new Map<BankSlug, UnifiedQuestion[]>();

/** Synchronous corpus loader for tests and offline data checks only. */
export function loadBankQuestions(slug: BankSlug): UnifiedQuestion[] {
  const cached = cache.get(slug);
  if (cached) return cached;
  const questions = normalizeBankQuestions(slug, rawBanks[slug].questions);
  cache.set(slug, questions);
  return questions;
}