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
import { buildSearchTopics } from "@/lib/site-search-topics";
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
      sessionCode: p.sessionCode, component: p.component, paper: p.paper, variant: p.variant, route: p.route,
      href: paperHref(p), title: paperCopy(bank, p).h1, detail: `${facts.join(" · ")} · ${shortSession(p.session)} ${p.year}`,
    });
  }
}

// Every syllabus topic and subtopic with its question count (src/lib/site-search-topics.ts).
const topics: SearchIndex["topics"] = [];
for (const bank of practiceBanks.values()) {
  const [manifest, questions] = await Promise.all([getLandingManifest(bank.slug), loadBankQuestions(bank.slug)]);
  const landings = manifest.topics.map(topic => ({ label: topic.label, href: topicPath(bank.slug, topic), count: topic.count }));
  topics.push(...buildSearchTopics(bank.slug, questions, landings, hasFreeTier(bank.slug)));
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
