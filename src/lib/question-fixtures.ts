import igcseData from "@/data/raw/igcse.json";
import igcseAdditionalData from "@/data/raw/igcse-additional.json";
import ibHlData from "@/data/raw/ib-hl.json";
import ibSlData from "@/data/raw/ib-sl.json";
import ibAiHlData from "@/data/raw/ib-ai-hl.json";
import ibAiSlData from "@/data/raw/ib-ai-sl.json";
import ibChemistryHlData from "@/data/raw/ib-chemistry-hl.json";
import ibChemistrySlData from "@/data/raw/ib-chemistry-sl.json";
import ibPhysicsHlData from "@/data/raw/ib-physics-hl.json";
import ibPhysicsSlData from "@/data/raw/ib-physics-sl.json";
import ibBiologyHlData from "@/data/raw/ib-biology-hl.json";
import ibBiologySlData from "@/data/raw/ib-biology-sl.json";
import { isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import { normalizeBankQuestions, type UnifiedQuestion } from "@/lib/questions";

type RawBank = { questions: Array<Record<string, unknown>> };
type ProductionBankSlug = Exclude<BankSlug, "ib-economics-hl" | "ib-economics-sl" | "igcse-biology-0610" | "igcse-economics-0455" | "igcse-chemistry-0620" | "igcse-physics-0625" | "igcse-coordinated-sciences-0654">;
const rawBanks: Record<ProductionBankSlug, RawBank> = {
  igcse: igcseData as RawBank,
  "igcse-additional": igcseAdditionalData as RawBank,
  "ib-hl": ibHlData as RawBank,
  "ib-sl": ibSlData as RawBank,
  "ib-ai-hl": ibAiHlData as RawBank,
  "ib-ai-sl": ibAiSlData as RawBank,
  "ib-chemistry-hl": ibChemistryHlData as RawBank,
  "ib-chemistry-sl": ibChemistrySlData as RawBank,
  "ib-physics-hl": ibPhysicsHlData as RawBank,
  "ib-physics-sl": ibPhysicsSlData as RawBank,
  "ib-biology-hl": ibBiologyHlData as RawBank,
  "ib-biology-sl": ibBiologySlData as RawBank,
};
const cache = new Map<BankSlug, UnifiedQuestion[]>();

/** Synchronous corpus loader for tests and offline data checks only. */
export function loadBankQuestions(slug: BankSlug): UnifiedQuestion[] {
  if (isLocalEconomicsBank(slug) || slug === "igcse-biology-0610" || slug === "igcse-economics-0455" || slug === "igcse-chemistry-0620" || slug === "igcse-physics-0625" || slug === "igcse-coordinated-sciences-0654") throw new Error("Private release banks use the async runtime loader");
  const cached = cache.get(slug);
  if (cached) return cached;
  const questions = normalizeBankQuestions(slug, rawBanks[slug].questions);
  cache.set(slug, questions);
  return questions;
}