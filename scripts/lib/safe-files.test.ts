// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalRoot, placeConfined, privateStaging, readConfined, safeSegments, workerCount } from "./safe-files";

let scratch: string;
let root: string;
let outside: string;
beforeEach(() => {
  scratch = mkdtempSync(join(realpathSync(tmpdir()), "safe-files-test-"));
  root = join(scratch, "root"); outside = join(scratch, "outside");
  mkdirSync(join(root, "a"), { recursive: true }); mkdirSync(outside);
  writeFileSync(join(root, "a", "ok.pdf"), "inside");
  writeFileSync(join(outside, "secret.pdf"), "outside");
});
afterEach(() => rmSync(scratch, { recursive: true, force: true }));

describe("confined reads", () => {
  it("reads a regular file inside the root", () => {
    expect(readConfined(root, "a/ok.pdf", 100).toString()).toBe("inside");
  });
  it("refuses a file symlinked outside the root", () => {
    symlinkSync(join(outside, "secret.pdf"), join(root, "a", "link.pdf"));
    expect(() => readConfined(root, "a/link.pdf", 100)).toThrow();
  });
  it("refuses a folder symlinked outside the root", () => {
    symlinkSync(outside, join(root, "b"));
    expect(() => readConfined(root, "b/secret.pdf", 100)).toThrow(/plain directory/);
  });
  it.each(["../outside/secret.pdf", "/etc/hosts", "a/../a/ok.pdf", "a//ok.pdf", "a\\ok.pdf", ""])("refuses unsafe path %j", (path) => {
    expect(() => readConfined(root, path, 100)).toThrow();
  });
  it("refuses files above the size limit", () => {
    expect(() => readConfined(root, "a/ok.pdf", 3)).toThrow(/Too large/);
  });
  it("accepts only canonical, existing directories as roots", () => {
    symlinkSync(root, join(scratch, "alias"));
    expect(canonicalRoot(join(scratch, "alias"))).toBe(root);
    expect(() => canonicalRoot("relative/root")).toThrow();
    expect(() => canonicalRoot(join(root, "a", "ok.pdf"))).toThrow();
  });
  it("splits only plain segments", () => {
    expect(safeSegments("igcse/questions/q1.webp")).toEqual(["igcse", "questions", "q1.webp"]);
    expect(() => safeSegments("igcse/.hidden/q1.webp")).toThrow();
  });
});

describe("private staging and placement", () => {
  it("creates a fresh 0700 folder and never writes through a planted symlink", () => {
    const staging = privateStaging("safe-files-test-");
    try {
      const planned = staging.path();
      symlinkSync(join(outside, "secret.pdf"), planned);
      const written = staging.write(Buffer.from("staged"));
      expect(written).not.toBe(planned);
      expect(readFileSync(join(outside, "secret.pdf"), "utf8")).toBe("outside");
      expect(readFileSync(written, "utf8")).toBe("staged");
    } finally { staging.dispose(); }
    expect(existsSync(staging.dir)).toBe(false);
  });
  it("places files inside the root and replaces a symlink at the target instead of writing through it", () => {
    const staging = privateStaging("safe-files-test-");
    try {
      symlinkSync(join(outside, "secret.pdf"), join(root, "a", "new.pdf"));
      placeConfined(root, "a/new.pdf", Buffer.from("placed"), staging);
      expect(readFileSync(join(outside, "secret.pdf"), "utf8")).toBe("outside");
      expect(readConfined(root, "a/new.pdf", 100).toString()).toBe("placed");
      placeConfined(root, "c/d/e.pdf", Buffer.from("nested"), staging);
      expect(readConfined(root, "c/d/e.pdf", 100).toString()).toBe("nested");
    } finally { staging.dispose(); }
  });
  it("refuses to place through a symlinked folder", () => {
    const staging = privateStaging("safe-files-test-");
    try {
      symlinkSync(outside, join(root, "b"));
      expect(() => placeConfined(root, "b/new.pdf", Buffer.from("x"), staging)).toThrow(/plain directory/);
      expect(existsSync(join(outside, "new.pdf"))).toBe(false);
    } finally { staging.dispose(); }
  });
});

describe("worker count", () => {
  it("accepts 1 to the limit and the default when unset", () => {
    expect(workerCount(undefined, 3)).toBe(3);
    expect(workerCount("", 3)).toBe(3);
    expect(workerCount("8", 3)).toBe(8);
  });
  it.each(["0", "-1", "1.5", "abc", "33"])("refuses JOBS=%s", (value) => {
    expect(() => workerCount(value, 3)).toThrow(/JOBS/);
  });
});
