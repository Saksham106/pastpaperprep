import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "generate-asset-manifest.mts");

describe("generate-asset-manifest --bank", () => {
  it("exits nonzero and writes no manifest when the bank's loader fails", () => {
    const result = spawnSync(process.execPath, ["--import", "tsx", script, "--bank", "no-such-bank"], { encoding: "utf8", cwd: process.cwd() });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("no-such-bank: question loader failed");
    expect(result.stdout).not.toContain("skipped");
    expect(existsSync(join(process.cwd(), "generated", "asset-manifest", "no-such-bank.preview.json"))).toBe(false);
  }, 60_000);
});
