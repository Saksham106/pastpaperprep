import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PUBLIC_BANK_INDEX_FILES } from "@/lib/bank-index-manifest";
import { buildTopicIndex, countNodes, knownKeys, partlyCovered, selectionMatcher, subtopicKey, toggleKey, topicKey, type BuilderQuestion } from "@/lib/builder-topics";
import type { BankSlug } from "@/lib/catalog";
import { getMathsPickerTopics } from "@/lib/maths-picker";
import { filterQuestions } from "@/lib/question-filter";
import type { PublicBankIndex } from "@/lib/question-index";
import type { UnifiedQuestion } from "@/lib/questions";

function load(bank: BankSlug): BuilderQuestion[] {
  const index = JSON.parse(readFileSync(join(process.cwd(), "public", "bank-index", PUBLIC_BANK_INDEX_FILES[bank as keyof typeof PUBLIC_BANK_INDEX_FILES]), "utf8")) as PublicBankIndex;
  return index.questions.map((question) => ({ ...question, bankSlug: bank }));
}

describe("builder topic index", () => {
  const biology = load("igcse-biology-0610");
  const biologyIndex = buildTopicIndex(biology, "igcse-biology-0610");

  it("uses the bank page's official headings, not raw section codes", () => {
    expect(biologyIndex.tree.length).toBeGreaterThan(10);
    const labels = biologyIndex.tree.flatMap((node) => node.subtopics.map((subtopic) => subtopic.label));
    expect(labels.length).toBeGreaterThan(20);
    expect(labels.some((label) => /^\d+(\.\d+)*$/.test(label))).toBe(false);
  });

  it("counts each node exactly as the bank page filter would when partial matches are included", () => {
    const all = biology.map((question) => ({ ...question, skills: question.skills ?? [], searchText: "", courseEra: "", secondarySubtopics: [] })) as unknown as UnifiedQuestion[];
    const counts = countNodes(biologyIndex, biology.map((question) => question.id), "any");
    const node = biologyIndex.tree[2];
    expect(counts.get(node.key)).toBe(filterQuestions(all, { topics: [node.key.slice(2)] }).length);
    const sub = node.subtopics[0];
    expect(counts.get(sub.key)).toBe(filterQuestions(all, { subtopics: [sub.key.split("␟")[1]] }).length);
  });

  it("drops nodes that have no questions in the bank", () => {
    const counts = countNodes(biologyIndex, biology.map((question) => question.id), "any");
    expect(biologyIndex.tree.every((node) => (counts.get(node.key) ?? 0) > 0 && node.subtopics.every((subtopic) => (counts.get(subtopic.key) ?? 0) > 0))).toBe(true);
  });

  it("follows the 0580 syllabus picker for clean maths banks", () => {
    const maths = load("igcse");
    const index = buildTopicIndex(maths, "igcse");
    const expected = getMathsPickerTopics(maths as never).filter((topic) => index.tree.some((node) => node.key === topicKey(topic)));
    expect(index.tree.map((node) => node.key)).toEqual(expected.map(topicKey));
    expect(index.tree[0].subtopics.length).toBeGreaterThan(3);
    // Earlier-syllabus aliases live only under "Earlier syllabus", never beside current sections.
    for (const node of index.tree) {
      const labels = node.subtopics.map((subtopic) => subtopic.label);
      expect(new Set(labels).size).toBe(labels.length);
      expect(node.subtopics.every((subtopic) => subtopic.key.includes("earlier-only:") === (node.label === "Earlier syllabus"))).toBe(true);
    }
  });

  it("matches any selected topic or subtopic, and everything when nothing is selected", () => {
    const [first, second] = biologyIndex.tree;
    const inFirst = biology.find((question) => biologyIndex.keysById.get(question.id)?.includes(first.key))!;
    const inSecondOnly = biology.find((question) => {
      const keys = biologyIndex.keysById.get(question.id) ?? [];
      return keys.includes(second.subtopics[0].key) && !keys.includes(first.key);
    })!;
    expect(selectionMatcher(biologyIndex, new Set(), "any")(inFirst.id)).toBe(true);
    const match = selectionMatcher(biologyIndex, new Set([first.key, second.subtopics[0].key]), "any");
    expect(match(inFirst.id) && match(inSecondOnly.id)).toBe(true);
    expect(selectionMatcher(biologyIndex, new Set([first.key]), "any")(inSecondOnly.id)).toBe(false);
  });
});

describe("main-topic scope", () => {
  const biology = load("igcse-biology-0610");
  const biologyIndex = buildTopicIndex(biology, "igcse-biology-0610");
  const chemistry = load("igcse-chemistry-0620");
  const chemistryIndex = buildTopicIndex(chemistry, "igcse-chemistry-0620");
  const classification = topicKey("Characteristics and classification of living organisms");

  // A student report: picking classification gave a 15-mark measles question about immunity,
  // tagged with classification only for its 2-mark "label the virus" part.
  it("by default leaves out questions that only partly cover a picked topic", () => {
    const measles = biology.find((question) => question.id === "0610-2019-m-42-q6")!;
    expect(measles.primaryTopic).toBe("Diseases and immunity");
    expect(selectionMatcher(biologyIndex, new Set([classification]))(measles.id)).toBe(false);
    expect(selectionMatcher(biologyIndex, new Set([classification]), "any")(measles.id)).toBe(true);
    expect(selectionMatcher(biologyIndex, new Set([topicKey("Diseases and immunity")]))(measles.id)).toBe(true);
  });

  it("counts only questions whose main topic is the node's, and every tagged question when partial matches are included", () => {
    const ids = chemistry.map((question) => question.id);
    const main = countNodes(chemistryIndex, ids);
    const any = countNodes(chemistryIndex, ids, "any");
    let partial = 0;
    for (const node of chemistryIndex.tree) {
      const topic = node.key.slice(2);
      expect(main.get(node.key) ?? 0).toBe(chemistry.filter((question) => question.primaryTopic === topic && chemistryIndex.keysById.get(question.id)?.includes(node.key)).length);
      expect(main.get(node.key) ?? 0).toBeLessThanOrEqual(any.get(node.key) ?? 0);
      partial += (any.get(node.key) ?? 0) - (main.get(node.key) ?? 0);
    }
    expect(partial).toBeGreaterThan(0);
  });

  it("keeps a picked subtopic to questions mainly on its parent topic", () => {
    for (const question of chemistry) {
      for (const key of chemistryIndex.mainKeysById.get(question.id) ?? []) {
        expect(question.primaryTopic).toBe(key.slice(2).split("␟")[0]);
      }
    }
  });

  it("names the picked topics a partial match covers", () => {
    const measles = biology.find((question) => question.id === "0610-2019-m-42-q6")!;
    const labels = (selection: string[]) => partlyCovered(biologyIndex, new Set(selection), measles.id);
    expect(labels([classification])).toEqual(["Characteristics and classification of living organisms"]);
    expect(labels([classification, topicKey("Diseases and immunity")])).toEqual([]);
  });
});

describe("toggleKey", () => {
  const tree = [{ key: topicKey("A"), label: "A", subtopics: [{ key: subtopicKey("A", "a1"), label: "a1" }, { key: subtopicKey("A", "a2"), label: "a2" }] }];
  it("picking a whole topic clears its subtopics, and the reverse", () => {
    const withSubs = toggleKey(tree, toggleKey(tree, new Set(), subtopicKey("A", "a1")), subtopicKey("A", "a2"));
    expect([...withSubs]).toEqual([subtopicKey("A", "a1"), subtopicKey("A", "a2")]);
    const whole = toggleKey(tree, withSubs, topicKey("A"));
    expect([...whole]).toEqual([topicKey("A")]);
    expect([...toggleKey(tree, whole, subtopicKey("A", "a1"))]).toEqual([subtopicKey("A", "a1")]);
    expect([...toggleKey(tree, whole, topicKey("A"))]).toEqual([]);
  });
  it("keeps only keys this tree knows", () => {
    expect([...knownKeys(tree, ["t:A", "t:Nope", "s:A␟zz"])]).toEqual(["t:A"]);
  });
});
