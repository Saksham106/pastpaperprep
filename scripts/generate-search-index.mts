#!/usr/bin/env tsx
// Prebuild: the site search's static files (src/lib/site-search.ts). public/search/index.json holds
// every subject (with its topic-practice and full-paper links) and every practice topic;
// public/search/papers.json holds every published full paper and is loaded only when a query looks
// like a paper; public/search/subjects.json is the subjects alone, for the dashboard. Static files are served by the CDN, so searching never runs a Vercel function.
// Runs with --conditions=react-server so server-only modules load outside Next.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bankEntryHref, hasFreeTier } from "@/lib/access";
import { BANK_CATALOG, getCatalogBanksForDisplay } from "@/lib/catalog";
import { paperHref, paperName, qualificationOfBank, shortSession, subjectSlugForBank } from "@/lib/past-paper-catalog";
import { formatDuration, paperCopy, subjectSearchName } from "@/lib/past-paper-seo";
import { getLandingManifest, topicPath } from "@/lib/search-landing";
import { loadBankQuestions } from "@/lib/question-loader";
import { filterQuestions } from "@/lib/question-filter";
import { SEARCH_INDEX_VERSION, subjectTerms, type SearchIndex, type SearchPaper, type SearchPapers } from "@/lib/site-search";
import { getWholePaperSummaries, wholePaperArchiveEnabled } from "@/lib/whole-paper-archive";

const practiceBanks = new Map(getCatalogBanksForDisplay().map(bank => [bank.slug, bank]));
const archive = await wholePaperArchiveEnabled();
const papers: SearchPaper[] = [];
const subjects: SearchIndex["subjects"] = [];

for (const bank of BANK_CATALOG) {
  const summaries = archive ? getWholePaperSummaries(bank.slug) : [];
  const practice = practiceBanks.get(bank.slug);
  if (!practice && !summaries.length) continue;
  const name = subjectSearchName(bank);
  subjects.push({
    bank: bank.slug, name, qualification: qualificationOfBank(bank.slug),
    practiceHref: practice ? bankEntryHref(bank.slug) : "",
    questionCount: practice?.questionCount ?? 0,
    papersHref: summaries.length ? `/past-papers/${subjectSlugForBank(bank.slug)}` : null,
    paperCount: summaries.length,
    terms: subjectTerms(name, bank.title, bank.subject, bank.syllabusCode ?? "", bank.level ?? "", bank.qualification),
  });
  for (const p of summaries) {
    const facts = [paperName(p), p.route === "Core" || p.route === "Extended" ? p.route : null, p.durationMinutes !== null ? formatDuration(p.durationMinutes) : null, p.maxMarks !== null ? `${p.maxMarks} marks` : null].filter(Boolean);
    papers.push({
      id: p.id, bankSlug: p.bankSlug, qualification: p.qualification, syllabusCode: p.syllabusCode, year: p.year, session: p.session,
      sessionCode: p.sessionCode, component: p.component, paper: p.paper, variant: p.variant,
      href: paperHref(p), title: paperCopy(bank, p).h1, detail: `${facts.join(" · ")} · ${shortSession(p.session)} ${p.year}`,
    });
  }
}

// Every syllabus topic and subtopic with its question count. Curated topics keep their landing
// page; the rest open the bank filtered to that topic (free questions first for visitors).
const topics: SearchIndex["topics"] = [];
for (const bank of practiceBanks.values()) {
  const [manifest, questions] = await Promise.all([getLandingManifest(bank.slug), loadBankQuestions(bank.slug)]);
  const landing = new Map(manifest.topics.map(topic => [topic.label, topicPath(bank.slug, topic)]));
  const filtered = (key: string, label: string) => {
    const params = new URLSearchParams(hasFreeTier(bank.slug) ? { free: "1", [key]: label } : { [key]: label });
    return `/banks/${bank.slug}?${params}`;
  };
  const topicCounts = new Map<string, number>();
  // A subtopic's parent is the topic most of its questions sit under.
  const subtopicCounts = new Map<string, Map<string, number>>();
  for (const q of questions) {
    topicCounts.set(q.primaryTopic, (topicCounts.get(q.primaryTopic) ?? 0) + 1);
    for (const sub of q.subtopics) {
      const parents = subtopicCounts.get(sub) ?? new Map<string, number>();
      parents.set(q.primaryTopic, (parents.get(q.primaryTopic) ?? 0) + 1);
      subtopicCounts.set(sub, parents);
    }
  }
  // Filtered links count what the explorer will actually show; banks map some labels through aliases.
  const shown = (key: "topics" | "subtopics", label: string) => filterQuestions(questions, { [key]: [label], sort: "paper" }).length;
  for (const [label, count] of topicCounts) {
    if (!label) continue;
    const page = landing.get(label);
    const n = page ? count : shown("topics", label);
    if (n) topics.push({ bank: bank.slug, label, parent: null, href: page ?? filtered("topic", label), count: n });
  }
  for (const [label, parents] of subtopicCounts) {
    if (!label || topicCounts.has(label)) continue;
    const ranked = [...parents].sort((a, b) => b[1] - a[1]);
    const n = shown("subtopics", label);
    if (n) topics.push({ bank: bank.slug, label, parent: ranked[0][0], href: filtered("subtopic", label), count: n });
  }
}

const dir = join(process.cwd(), "public", "search");
await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });
const index: SearchIndex = { version: SEARCH_INDEX_VERSION, subjects, topics };
const paperIndex: SearchPapers = { version: SEARCH_INDEX_VERSION, papers };
await writeFile(join(dir, "index.json"), JSON.stringify(index));
await writeFile(join(dir, "papers.json"), JSON.stringify(paperIndex));
// Just the subjects, for the dashboard's full-paper links.
await writeFile(join(dir, "subjects.json"), JSON.stringify({ version: SEARCH_INDEX_VERSION, subjects }));
console.log(`search index: ${subjects.length} subjects, ${topics.length} topics, ${papers.length} papers${archive ? "" : " (paper library off)"}`);
