import { describe, expect, it } from "vitest";
import { pdfExportKey } from "./pdf-export-key";

describe("pdfExportKey", () => {
  it("is the same for the same worksheet in any order, and differs when the worksheet differs", () => {
    const key = pdfExportKey("ib-hl", "both", ["q2", "q1"]);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(pdfExportKey("ib-hl", "both", ["q1", "q2"])).toBe(key);
    expect(pdfExportKey("ib-hl", "questions", ["q1", "q2"])).not.toBe(key);
    expect(pdfExportKey("ib-sl", "both", ["q1", "q2"])).not.toBe(key);
    expect(pdfExportKey("ib-hl", "both", ["q1", "q2", "q3"])).not.toBe(key);
  });
});
