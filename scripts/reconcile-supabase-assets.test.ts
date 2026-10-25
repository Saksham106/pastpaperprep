// @vitest-environment node
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXPECTED_ASSET_TOTALS } from "@/lib/asset-retention";

const repo = join(import.meta.dirname, "..");

describe("reconcile-supabase-assets --plan-only", () => {
  it("passes its own plan guards on the current corpus, with R2-signed free years retained nowhere in Supabase", () => {
    const result = spawnSync(process.execPath, [join(repo, "node_modules/tsx/dist/cli.mjs"), join(repo, "scripts/reconcile-supabase-assets.ts"), "--plan-only"], {
      cwd: repo, encoding: "utf8", env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SECRET_KEY: "" },
    });
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Retain in Supabase: ${EXPECTED_ASSET_TOTALS.preview.toLocaleString()} preview objects.`);
    expect(result.stdout).toContain(`${EXPECTED_ASSET_TOTALS.premium.toLocaleString()} premium objects.`);
  }, 120_000);
});
