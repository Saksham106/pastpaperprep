import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import membershipSeal from "@/data/ib-economics-2026-may-membership-seal.json";
import hlRuntime from "@/data/production/ib-economics-hl.json";
import hlArchive from "@/data/paper-archives/ib-economics-hl.json";
import slArchive from "@/data/paper-archives/ib-economics-sl.json";
import { ECONOMICS_MAY_2026_MEMBERSHIP_SEAL_SHA256, ECONOMICS_MAY_2026_SEALS } from "@/lib/economics-runtime";

const ROOT = process.cwd();
const sha = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

describe("May 2026 membership seal is independent of the artifact", () => {
  it("is pinned by hash in code and matches the pinned bank counts", () => {
    expect(sha(readFileSync(join(ROOT, "src/data/ib-economics-2026-may-membership-seal.json")))).toBe(ECONOMICS_MAY_2026_MEMBERSHIP_SEAL_SHA256);
    expect(membershipSeal.reviewedOrderedQuestionIds).toHaveLength(26);
    for (const bank of ["ib-economics-hl", "ib-economics-sl"] as const) {
      expect(membershipSeal.banks[bank].questionIds).toHaveLength(ECONOMICS_MAY_2026_SEALS.banks[bank].questionCount);
      expect(membershipSeal.banks[bank].paperIds).toHaveLength(ECONOMICS_MAY_2026_SEALS.banks[bank].paperCount);
    }
  });

  describe("runtime fails closed on same-count substitution", () => {
    afterEach(() => {
      vi.doUnmock("@/data/production/ib-economics-hl.json");
      vi.resetModules();
    });
    const load = async (mutate: (artifact: typeof hlRuntime) => void) => {
      const artifact = clone(hlRuntime);
      mutate(artifact);
      // Re-seal the self-declared content hash, as the reviewer's replay did.
      artifact.runtimeArtifact.contentSha256 = sha(JSON.stringify(artifact.questions));
      vi.resetModules();
      vi.doMock("@/data/production/ib-economics-hl.json", () => ({ default: artifact }));
      return import("@/lib/economics-runtime");
    };

    it("accepts the unmodified artifact", async () => {
      const mod = await load(() => {});
      expect(() => mod.getEconomicsRuntimeArtifact("ib-economics-hl")).not.toThrow();
    });

    it("rejects renaming the last HL addition to a forged 2026-may id", async () => {
      const mod = await load((artifact) => {
        const last = artifact.questions.at(-1)!;
        last.id = "2026-may-forged-q99";
        last.canonicalId = "2026-may-forged-q99";
      });
      expect(() => mod.getEconomicsRuntimeArtifact("ib-economics-hl")).toThrow(/membership mismatch/);
    });

    it("rejects a same-count forged paper replacement", async () => {
      const mod = await load((artifact) => {
        (artifact.papers as unknown[])[artifact.papers.length - 1] = { id: "forged-paper" };
      });
      expect(() => mod.getEconomicsRuntimeArtifact("ib-economics-hl")).toThrow(/membership mismatch/);
    });

    it("rejects a same-id edit of an added row's marks", async () => {
      const mod = await load((artifact) => {
        const last = artifact.questions.at(-1)! as unknown as { marks: number };
        last.marks += 1;
      });
      expect(() => mod.getEconomicsRuntimeArtifact("ib-economics-hl")).toThrow(/membership mismatch/);
    });
  });

  const sourceRoot = process.env.PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT ?? resolve(ROOT, "..", "..", "..", "ib-economics-topic-practice", ".worktrees", "may-2026");
  describe.skipIf(!existsSync(join(sourceRoot, "data/may-2026/site-data")))("generator fails closed on same-count substitution", () => {
    const temps: string[] = [];
    afterEach(() => temps.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
    const run = (mutate?: (hlSite: { questions: { id: string; canonicalId: string }[] }) => void) => {
      const dir = mkdtempSync(join(tmpdir(), "eco-may-"));
      temps.push(dir);
      cpSync(join(sourceRoot, "data"), join(dir, "data"), { recursive: true });
      symlinkSync(join(sourceRoot, "site"), join(dir, "site"));
      if (mutate) {
        const file = join(dir, "data/may-2026/site-data/questions-hl-2026-may.json");
        const site = JSON.parse(readFileSync(file, "utf8"));
        mutate(site);
        writeFileSync(file, JSON.stringify(site));
      }
      return spawnSync("node", ["scripts/generate-ib-economics-2026-may.mjs", "--check"], {
        cwd: ROOT, env: { ...process.env, PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT: dir }, encoding: "utf8",
      });
    };

    it("reproduces all 12 outputs byte-identically from the real source", () => {
      const result = run();
      expect(result.stdout).toContain('"byte-identical"');
      expect(result.status).toBe(0);
    });

    it("rejects a forged id on the last HL site question", () => {
      const result = run((site) => {
        const last = site.questions.at(-1)!;
        last.id = "2026-may-forged-q99";
        last.canonicalId = "2026-may-forged-q99";
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/membership differs from the sealed reviewed set/);
    });
  });
});

describe("Economics P2 archive summaries count whole optional questions", () => {
  it("reports 2 questions (max 40) for the six May 2026 P2 papers, and never the lettered-part segment count", () => {
    for (const archive of [hlArchive, slArchive]) {
      const p2 = archive.papers.filter((paper) => paper.summary.id.includes("-2026-may-") && paper.summary.component === "P2");
      expect(p2).toHaveLength(3);
      for (const paper of p2) expect(paper.summary).toMatchObject({ questionCount: 2, maxMarks: 40 });
    }
  });

  it("matches the optional-question count of every held Economics P2 paper (2022 onwards: 2)", () => {
    for (const archive of [hlArchive, slArchive]) {
      for (const paper of archive.papers) {
        const { component, year, reportReason, questionCount } = paper.summary;
        if (component === "P2" && year >= 2022 && reportReason === "Optional question choices need review.") expect(questionCount).toBe(2);
      }
    }
  });
});
