// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { WholePaperManifest } from "../../src/lib/whole-paper-types";
import { assertPlanIsApprovedMembership, newlyApproved, type FreePlanInput } from "./approved-free-plan";

const root = resolve(__dirname, "../..");
const MANIFEST_DIR = join(root, "src/data/paper-archives");
const head = readdirSync(MANIFEST_DIR).filter((f) => f.endsWith(".json")).sort()
  .map((f) => JSON.parse(readFileSync(join(MANIFEST_DIR, f), "utf8")) as WholePaperManifest);
// The base is the head without the 18 IB Biology May 2026 papers (the only newly approved PDFs in this change).
const base = head.map((m) => (m.bankSlug.startsWith("ib-biology-") ? { ...m, papers: m.papers.filter((p) => p.summary.year !== 2026) } : m));
const committed = JSON.parse(readFileSync(join(root, "docs/ib-biology-may-2026/r2-upload-plan-free-papers.json"), "utf8")) as { appBaseCommit: string; approvedObjectsAfter: number; objects: FreePlanInput["added"] };
// Later banks add their own approved PDFs, so the total approved count grows past the plan's recorded
// `approvedObjectsAfter`; membership (the 36 Biology rows) is what this plan pins.
const approvedNow = newlyApproved(base, head).approvedAfter;
const valid = (): FreePlanInput => ({ base: committed.appBaseCommit, approvedObjects: approvedNow, added: committed.objects.map((o) => ({ ...o })) });
const swap = (edit: (rows: FreePlanInput["added"]) => void) => { const plan = valid(); edit(plan.added); return plan; };

describe("approved free-papers plan membership", () => {
  it("derives exactly the 36 PDFs the IB Biology manifests newly approve, and the committed plan equals them", () => {
    const { added, approvedAfter } = newlyApproved(base, head);
    expect(added.size).toBe(36);
    expect(approvedAfter).toBeGreaterThanOrEqual(committed.approvedObjectsAfter);
    expect(() => assertPlanIsApprovedMembership(valid(), base, head)).not.toThrow();
  });

  it("rejects a same-count substitution of a key and hash, even when both are internally consistent", () => {
    const plan = swap((rows) => { rows[0] = { ...rows[0], sha256: "a".repeat(64), key: `papers/v1/${"a".repeat(64)}.pdf` }; });
    expect(plan.added).toHaveLength(36);
    expect(() => assertPlanIsApprovedMembership(plan, base, head)).toThrow(/not newly approved/);
  });

  it("rejects a substituted hash under an approved key", () => {
    expect(() => assertPlanIsApprovedMembership(swap((rows) => { rows[3] = { ...rows[3], sha256: "b".repeat(64) }; }), base, head)).toThrow(/hash differs/);
  });

  it("rejects a changed size, a changed download name, a duplicated row and a changed approved count", () => {
    expect(() => assertPlanIsApprovedMembership(swap((rows) => { rows[1] = { ...rows[1], bytes: rows[1].bytes + 1 }; }), base, head)).toThrow(/size differs/);
    expect(() => assertPlanIsApprovedMembership(swap((rows) => { rows[2] = { ...rows[2], name: "other-name.pdf" }; }), base, head)).toThrow(/name differs/);
    expect(() => assertPlanIsApprovedMembership(swap((rows) => { rows[5] = { ...rows[4] }; }), base, head)).toThrow(/Duplicate plan key/);
    expect(() => assertPlanIsApprovedMembership({ ...valid(), approvedObjects: approvedNow + 1 }, base, head)).toThrow(/approved objects/);
  });

  it("rejects an omitted or an extra PDF", () => {
    expect(() => assertPlanIsApprovedMembership(swap((rows) => { rows.pop(); }), base, head)).toThrow(/lists 35/);
    expect(() => assertPlanIsApprovedMembership(swap((rows) => { rows.push({ ...rows[0], sha256: "c".repeat(64), key: `papers/v1/${"c".repeat(64)}.pdf` }); }), base, head)).toThrow(/lists 37/);
  });

  const sourceLane = resolve(root, "../../../ib-biology-topic-practice/.worktrees/may-2026/data/release-2026/asset-inventory.json");
  it.skipIf(!existsSync(sourceLane))("the real planner script refuses a same-count substituted plan instead of emitting it as approved", { timeout: 120_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "ib-bio-plan-"));
    try {
      // The planner scopes its head to the Biology manifests, so its approved count is the plan's own.
      const bad = { ...swap((rows) => { rows[0] = { ...rows[0], sha256: "a".repeat(64), key: `papers/v1/${"a".repeat(64)}.pdf` }; }), approvedObjects: committed.approvedObjectsAfter };
      const input = join(dir, "plan.json");
      writeFileSync(input, JSON.stringify(bad));
      let message = "";
      try { execFileSync("npx", ["tsx", "scripts/plan-ib-biology-2026-uploads.mts", "--check", input], { cwd: root, encoding: "utf8", stdio: "pipe" }); } catch (error) { message = String((error as { stderr?: string }).stderr); }
      expect(message).toMatch(/not newly approved/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
