import type { BankSlug } from "@/lib/banks";
import { normalizeBankQuestions, type UnifiedQuestion } from "@/lib/questions";

type RawBank = { questions: Array<Record<string, unknown>> };

const loaders: Record<BankSlug, () => Promise<RawBank>> = {
  igcse: async () => (await import("@/data/raw/igcse.json")).default as RawBank,
  "igcse-additional": async () => (await import("@/data/raw/igcse-additional.json")).default as RawBank,
  "ib-hl": async () => (await import("@/data/raw/ib-hl.json")).default as RawBank,
  "ib-sl": async () => (await import("@/data/raw/ib-sl.json")).default as RawBank,
  "ib-ai-hl": async () => (await import("@/data/raw/ib-ai-hl.json")).default as RawBank,
  "ib-ai-sl": async () => (await import("@/data/raw/ib-ai-sl.json")).default as RawBank,
  "ib-chemistry-hl": async () => (await import("@/data/raw/ib-chemistry-hl.json")).default as RawBank,
  "ib-chemistry-sl": async () => (await import("@/data/raw/ib-chemistry-sl.json")).default as RawBank,
  "ib-physics-hl": async () => (await import("@/data/raw/ib-physics-hl.json")).default as RawBank,
  "ib-physics-sl": async () => (await import("@/data/raw/ib-physics-sl.json")).default as RawBank,
};

const cache = new Map<BankSlug, Promise<UnifiedQuestion[]>>();

export function loadBankQuestions(slug: BankSlug): Promise<UnifiedQuestion[]> {
  const cached = cache.get(slug);
  if (cached) return cached;

  const questions = loaders[slug]().then((raw) => normalizeBankQuestions(slug, raw.questions));
  cache.set(slug, questions);
  return questions;
}