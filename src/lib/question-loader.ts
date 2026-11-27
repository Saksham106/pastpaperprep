import { isEconomicsProductionEnabled, isIGCSEReleaseBank, isIGCSEReleaseEnabled, isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import { bankRuntimeCacheKey } from "@/lib/bank-runtime-key";
import { getEconomicsRuntimeArtifact } from "@/lib/economics-runtime";
import { normalizeBankQuestions, type UnifiedQuestion } from "@/lib/questions";
import { isPendingStoragePreview } from "@/lib/catalog";
import { join } from "node:path";
import { readCorpusJson } from "@/lib/corpus-json";

type RawBank = { questions: Array<Record<string, unknown>> };

// Banks are read from disk, not imported (see src/lib/corpus-json.ts). Keep each path a literal so file tracing finds it.
const corpus = (path: string) => async () => readCorpusJson(path) as RawBank;

const loaders: Record<BankSlug, () => Promise<RawBank>> = {
  igcse: corpus(join(process.cwd(), "src/data/raw/igcse.json")),
  "igcse-additional": corpus(join(process.cwd(), "src/data/raw/igcse-additional.json")),
  "ib-hl": corpus(join(process.cwd(), "src/data/raw/ib-hl.json")),
  "ib-sl": corpus(join(process.cwd(), "src/data/raw/ib-sl.json")),
  "ib-ai-hl": corpus(join(process.cwd(), "src/data/raw/ib-ai-hl.json")),
  "ib-ai-sl": corpus(join(process.cwd(), "src/data/raw/ib-ai-sl.json")),
  "ib-chemistry-hl": corpus(join(process.cwd(), "src/data/raw/ib-chemistry-hl.json")),
  "ib-chemistry-sl": corpus(join(process.cwd(), "src/data/raw/ib-chemistry-sl.json")),
  "ib-physics-hl": corpus(join(process.cwd(), "src/data/raw/ib-physics-hl.json")),
  "ib-physics-sl": corpus(join(process.cwd(), "src/data/raw/ib-physics-sl.json")),
  "ib-biology-hl": corpus(join(process.cwd(), "src/data/raw/ib-biology-hl.json")),
  "ib-biology-sl": corpus(join(process.cwd(), "src/data/raw/ib-biology-sl.json")),
  "ib-economics-hl": corpus(join(process.cwd(), "src/data/local-preview/ib-economics-hl.json")),
  "ib-economics-sl": corpus(join(process.cwd(), "src/data/local-preview/ib-economics-sl.json")),
  "igcse-biology-0610": corpus(join(process.cwd(), "src/data/production/igcse-biology-0610.json")),
  "igcse-economics-0455": corpus(join(process.cwd(), "src/data/production/igcse-economics-0455.json")),
  "igcse-chemistry-0620": corpus(join(process.cwd(), "src/data/production/igcse-chemistry-0620.json")),
  "igcse-physics-0625": corpus(join(process.cwd(), "src/data/production/igcse-physics-0625.json")),
  "igcse-coordinated-sciences-0654": corpus(join(process.cwd(), "src/data/production/igcse-coordinated-sciences-0654.json")),
  "igcse-computer-science-0478": corpus(join(process.cwd(), "src/data/production/igcse-computer-science-0478.json")),
  "ib-computer-science-hl": corpus(join(process.cwd(), "src/data/production/ib-computer-science-hl.json")),
  "ib-computer-science-sl": corpus(join(process.cwd(), "src/data/production/ib-computer-science-sl.json")),
  "ib-business-management-hl": corpus(join(process.cwd(), "src/data/production/ib-business-management-hl.json")),
  "ib-business-management-sl": corpus(join(process.cwd(), "src/data/production/ib-business-management-sl.json")),
  // Candidate runtime; the bank stays hidden (pendingStorage) until its crops are uploaded and it is finalized.
  "a-level-maths-9709": corpus(join(process.cwd(), "src/data/production/a-level-maths-9709.json")),
  "a-level-physics-9702": corpus(join(process.cwd(), "src/data/production/a-level-physics-9702.json")),
  "a-level-chemistry-9701": corpus(join(process.cwd(), "src/data/production/a-level-chemistry-9701.json")),
  "a-level-biology-9700": corpus(join(process.cwd(), "src/data/production/a-level-biology-9700.json")),
  "a-level-economics-9708": corpus(join(process.cwd(), "src/data/production/a-level-economics-9708.json")),
  "a-level-computer-science-9618": corpus(join(process.cwd(), "src/data/production/a-level-computer-science-9618.json")),
  "a-level-further-maths-9231": corpus(join(process.cwd(), "src/data/production/a-level-further-maths-9231.json")),
};

const cache = new Map<string, Promise<UnifiedQuestion[]>>();
const questionIndexCache = new Map<string, Promise<ReadonlyMap<string, UnifiedQuestion>>>();


export function loadBankQuestionMap(slug: BankSlug): Promise<ReadonlyMap<string, UnifiedQuestion>> {
  const cacheKey = bankRuntimeCacheKey(slug);
  const cached = questionIndexCache.get(cacheKey);
  if (cached) return cached;

  const index = loadBankQuestions(slug).then((questions) =>
    new Map(questions.map((question) => [question.id, question])),
  );
  questionIndexCache.set(cacheKey, index);
  void index.catch(() => {
    if (questionIndexCache.get(cacheKey) === index) questionIndexCache.delete(cacheKey);
  });
  return index;
}

/** The bank's source rows for this environment, before normalization (server-only fields intact). */
export function loadBankRawQuestions(slug: BankSlug): Promise<ReadonlyArray<Record<string, unknown>>> {
  const productionEconomics = isLocalEconomicsBank(slug) && isEconomicsProductionEnabled();
  const productionIGCSE = isIGCSEReleaseBank(slug) && isIGCSEReleaseEnabled() && !isPendingStoragePreview(slug);
  return (productionEconomics
    ? Promise.resolve(getEconomicsRuntimeArtifact(slug) as unknown as RawBank)
    : productionIGCSE
      ? import("@/lib/igcse-runtime").then(({ getIGCSERuntimeArtifact }) => getIGCSERuntimeArtifact(slug) as unknown as RawBank)
    : loaders[slug]())
    .then((raw) => raw.questions);
}

export function loadBankQuestions(slug: BankSlug): Promise<UnifiedQuestion[]> {
  const productionEconomics = isLocalEconomicsBank(slug) && isEconomicsProductionEnabled();
  const productionIGCSE = isIGCSEReleaseBank(slug) && isIGCSEReleaseEnabled() && !isPendingStoragePreview(slug);
  const production = productionEconomics || productionIGCSE;
  const cacheKey = bankRuntimeCacheKey(slug);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const questions = loadBankRawQuestions(slug)
    .then((rows) => normalizeBankQuestions(slug, rows as Array<Record<string, unknown>>, {
      economicsAssetMode: production ? "private" : "local",
      applyReviewedBlankPages: productionIGCSE || slug === 'igcse' || slug === 'igcse-additional',
    }));
  cache.set(cacheKey, questions);
  void questions.catch(() => {
    if (cache.get(cacheKey) === questions) cache.delete(cacheKey);
  });
  return questions;
}
