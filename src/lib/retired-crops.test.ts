import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import retired from "@/data/retired-question-crops.json";
import { activeQuestionCropPaths } from "@/lib/retired-crops";

const receipt = JSON.parse(readFileSync("docs/audits/2026-10-16-periodic-table-pages/receipt.json", "utf8")) as {
  counts: Record<string, number>; entries: Array<{ bank: string; id: string; path: string }>;
};
const list = retired as Record<string, Record<string, string[]>>;

describe("retired page-furniture crops", () => {
  it("retires every audited Periodic Table page, and only those, in Chemistry and Co-ordinated Sciences", () => {
    expect(receipt.counts).toEqual({ "igcse-chemistry-0620": 211, "igcse-coordinated-sciences-0654": 164 });
    for (const entry of receipt.entries) expect(list[entry.bank][entry.id]).toContain(entry.path);
    for (const bank of ["igcse-chemistry-0620", "igcse-coordinated-sciences-0654"]) {
      expect(Object.values(list[bank]).flat()).toHaveLength(receipt.counts[bank]);
    }
  });

  it("keeps a question page that only mentions the Periodic Table", () => {
    expect(list["igcse-coordinated-sciences-0654"]["0654-2025-winter-31-q5"]).toBeUndefined();
  });

  it("drops only the retired page and refuses to empty a question", () => {
    const [id, [page]] = Object.entries(list["igcse-chemistry-0620"])[0];
    const paths = [`questions/${id.replace(/-q\d+$/, "")}/kept.webp`, page];
    expect(activeQuestionCropPaths("igcse-chemistry-0620", id, paths)).toEqual([paths[0]]);
    expect(() => activeQuestionCropPaths("igcse-chemistry-0620", id, [page])).toThrow(/disagrees/);
  });
});
