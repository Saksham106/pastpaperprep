import { describe, expect, it } from "vitest";
import { pdfExportKey } from "./pdf-export-key";

describe("pdfExportKey", () => {
  it("is the same for the same worksheet in any order, and differs when the worksheet differs", () => {
    const key = pdfExportKey("ib-hl", "both", ["q2", "q1"], "secret");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(pdfExportKey("ib-hl", "both", ["q1", "q2"], "secret")).toBe(key);
    expect(pdfExportKey("ib-hl", "questions", ["q1", "q2"], "secret")).not.toBe(key);
    expect(pdfExportKey("ib-sl", "both", ["q1", "q2"], "secret")).not.toBe(key);
    expect(pdfExportKey("ib-hl", "both", ["q1", "q2", "q3"], "secret")).not.toBe(key);
  });

  it("needs the server secret, so a client can't compute a worksheet's key", () => {
    expect(pdfExportKey("ib-hl", "both", ["q1"], "secret")).not.toBe(pdfExportKey("ib-hl", "both", ["q1"], "other-secret"));
    expect(pdfExportKey("ib-hl", "both", ["q1"], "")).toBeNull();
    expect(pdfExportKey("ib-hl", "both", ["q1"], undefined)).toBeNull();
  });
});
