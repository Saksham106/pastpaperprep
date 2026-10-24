import { describe, expect, it } from "vitest";
import { searchQuestionIds } from "@/lib/question-search";
import { prepareQuestionsForDelivery } from "@/lib/question-delivery";
import type { UnifiedQuestion } from "@/lib/questions";
import type { AccessEntitlement } from "@/lib/access";

function row(overrides: Partial<UnifiedQuestion> = {}): UnifiedQuestion {
  return {
    id: "0580-2024-may-22-q4", bankSlug: "igcse", number: 4, paper: 2,
    year: 2024, session: "May", primaryTopic: "Algebra", secondaryTopics: ["Graphs"],
    skills: ["Solve"], subtopics: ["Quadratics"], secondarySubtopics: [], subject: "Math",
    courseEra: "Current", option: "", zone: "TZ1", component: "22", calculator: true,
    marks: 3, summary: "Private summary", accessibleText: "Private question", searchText: "algebra private phrase",
    questionImages: [], markschemeImages: [], questionImageCount: 0, markschemeImageCount: 0,
    questionAssetPaths: [], markschemeAssetPaths: [], solution: null,
    sourceQuestionUrl: null, sourceMarkSchemeUrl: null, ...overrides,
  };
}
const now = new Date("2026-10-24T12:00:00Z");
const paid: AccessEntitlement = { productId: "bank_igcse", status: "active", startsAt: "2026-01-01T00:00:00Z", expiresAt: "2026-10-25T00:00:00Z" };
function legacy(rows: readonly UnifiedQuestion[], query: string, grants: readonly AccessEntitlement[], at = now, local = false) {
  if (!query.trim()) return [];
  return prepareQuestionsForDelivery(rows, grants, at, local)
    .filter(q => q.searchText.includes(query.trim().toLocaleLowerCase())).map(q => q.id);
}

describe("ID-only search preparation", () => {
  it("does not read or project discarded rich delivery fields", () => {
    const question = row();
    let reads = 0;
    Object.defineProperty(question, "summary", { enumerable: true, get() { reads++; return "Private summary"; } });
    expect(searchQuestionIds([question], "private", [paid], now)).toEqual([question.id]);
    expect(reads).toBe(0);
  });

  it("reuses invariant preparation by corpus identity without retaining authorization", () => {
    const question = row();
    let reads = 0;
    Object.defineProperty(question, "primaryTopic", { get() { reads++; return "Algebra"; } });
    const rows = [question];
    expect(searchQuestionIds(rows, "Algebra", [], now)).toEqual([question.id]);
    const preparedReads = reads;
    expect(searchQuestionIds(rows, "Algebra", [], now)).toEqual([question.id]);
    expect(reads).toBe(preparedReads);
    expect(searchQuestionIds(rows, "private", [paid], now)).toEqual([question.id]);
    expect(searchQuestionIds(rows, "private", [paid], new Date(paid.expiresAt!))).toEqual([]);
    expect(searchQuestionIds([row({ primaryTopic: "Geometry" })], "Geometry", [], now)).toEqual([question.id]);
  });

  it("retries preparation after a failure without publishing partial rows", () => {
    let fail = true;
    const question = row();
    Object.defineProperty(question, "primaryTopic", { get() {
      if (fail) throw new Error("transient preparation failure");
      return "Algebra";
    } });
    const rows = [row(), question];
    expect(() => searchQuestionIds(rows, "algebra", [], now)).toThrow("transient preparation failure");
    fail = false;
    expect(searchQuestionIds(rows, "algebra", [], now)).toEqual(rows.map(q => q.id));
  });

  it("matches real delivery IDs and order for all access and date boundaries", () => {
    const rows = [row(), row({ id: "0580-2016-march-22-q1", year: 2016 }),
      row({ id: "2024-may-hl-q1", bankSlug: "ib-economics-hl" }),
      row({ id: "0620-2024-may-22-q1", bankSlug: "igcse-chemistry-0620" })];
    const grants: AccessEntitlement[][] = [[], [paid], [{ ...paid, status: "trialing" }],
      [{ ...paid, status: "expired" }], [{ ...paid, status: "revoked" }],
      [{ ...paid, startsAt: null }], [{ ...paid, startsAt: "invalid" }], [{ ...paid, expiresAt: "invalid" }],
      [{ ...paid, productId: "bundle_all" }], [{ ...paid, productId: "lifetime_all_access", expiresAt: null }],
      [{ ...paid, productId: "bundle_igcse" }],
      [{ ...paid, productId: "bundle_custom", selectedBankIds: ["igcse-chemistry-0620"] }],
      [{ ...paid, productId: "bundle_custom", selectedBankIds: [] }]];
    const times = [new Date("2025-12-31T23:59:59.999Z"), new Date(paid.startsAt!), now,
      new Date("2026-10-24T23:59:59.999Z"), new Date(paid.expiresAt!), new Date("2026-10-25T00:00:00.001Z")];
    for (const access of grants) for (const at of times) for (const local of [false, true]) {
      for (const query of ["private", " PRIVATE phrase ", "AlGeBrA", "2024", "TZ1", "graphs solve", "private  phrase", "", " \t ", "missing"]) {
        expect(searchQuestionIds(rows, query, access, at, local)).toEqual(legacy(rows, query, access, at, local));
      }
    }
  });
});
