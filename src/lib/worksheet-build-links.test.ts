import { describe, expect, it } from "vitest";
import { buildPaperLoginPath, buildPaperPath } from "./worksheet-build-links";

describe("paper builder links", () => {
  it("preselects the bank", () => {
    expect(buildPaperPath()).toBe("/worksheets/build");
    expect(buildPaperPath("ib-chemistry-sl")).toBe("/worksheets/build?bank=ib-chemistry-sl");
  });
  it("signs in first and returns to the same builder URL", () => {
    expect(buildPaperLoginPath("igcse-chemistry-0620")).toBe("/login?next=%2Fworksheets%2Fbuild%3Fbank%3Digcse-chemistry-0620");
    expect(buildPaperLoginPath()).toBe("/login?next=%2Fworksheets%2Fbuild");
  });
});
