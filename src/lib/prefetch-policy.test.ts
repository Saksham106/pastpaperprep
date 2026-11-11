import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NO_PREFETCH_PATHS, prefetchesNothing } from "./prefetch-policy";

describe("prefetch policy", () => {
  it("skips per-request pages with no loading screen, whatever the query", () => {
    expect(prefetchesNothing("/login")).toBe(true);
    expect(prefetchesNothing("/login?next=%2Fpricing")).toBe(true);
    expect(prefetchesNothing("/worksheets/build?bank=ib-sl")).toBe(true);
    expect(prefetchesNothing({ pathname: "/login", query: { mode: "sign-up" } })).toBe(true);
    expect(prefetchesNothing("/worksheets")).toBe(false);
    expect(prefetchesNothing("/loginx")).toBe(false);
    expect(prefetchesNothing("/dashboard")).toBe(false);
    expect(prefetchesNothing("https://example.com/login")).toBe(false);
  });

  it("holds only while those routes have no loading.tsx", () => {
    // Next prefetches a dynamic route only down to its nearest loading.tsx. With none, the
    // request runs the page function and keeps nothing: revisit this list if one is added.
    for (const path of NO_PREFETCH_PATHS) expect(existsSync(join(process.cwd(), "src/app", path, "loading.tsx")), path).toBe(false);
  });

  it("plain links to those routes opt out of viewport prefetch", () => {
    const files = [
      "src/components/FreeQuestionSignupGate.tsx",
      "src/components/ExamStyleAASLPage.tsx",
      "src/components/ExamStyleCoursePage.tsx",
      "src/app/banks/ib-hl/exam-style/page.tsx",
      "src/app/banks/ib-sl/exam-style/trigonometry/page.tsx",
      "src/app/auth/email-link/page.tsx",
      "src/app/auth/recovery/page.tsx",
      "src/app/worksheets/page.tsx",
    ];
    const target = /href=\{?["'`]?(\/login|\/worksheets\/build)|href=\{(signupHref|signinHref|loginHref)\}/;
    for (const file of files) {
      const links = readFileSync(join(process.cwd(), file), "utf8").match(/<Link\b[^>]*>/g) ?? [];
      const offenders = links.filter((tag) => target.test(tag) && !tag.includes("prefetch={false}"));
      expect(offenders, file).toEqual([]);
    }
  });
});
