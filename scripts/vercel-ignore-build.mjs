#!/usr/bin/env node
import { execFileSync } from "node:child_process";

// Vercel's ignoreCommand exits 0 to SKIP, 1 to BUILD. Fail open on any uncertainty.
// docs/ contains live JSON inputs, so only prose files are eligible—not whole folders.
function shouldSkipPreview() {
  if (process.env.VERCEL_ENV !== "preview") return false;
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  const current = process.env.VERCEL_GIT_COMMIT_SHA;
  if (![previous, current].every(value => typeof value === "string" && /^[a-f0-9]{40}$/i.test(value))) return false;
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10_000 });
  try {
    if (git("rev-parse", "HEAD").trim() !== current) return false;
    git("merge-base", "--is-ancestor", previous, current);
    // Disable rename detection: renaming runtime data to a prose path must still BUILD.
    const paths = git("diff", "--name-only", "--no-renames", "-z", previous, current, "--").split("\0").filter(Boolean);
    if (!paths.length || !paths.every(path =>
      path === "README.md" || (path.startsWith("docs/") && (path.endsWith(".md") || path.endsWith(".txt")))
    )) return false;
    // Inspect both trees so deleted or replaced symlinks/executables cannot be skipped.
    const entries = [previous, current].flatMap(ref => git("ls-tree", "-z", ref, "--", ...paths).split("\0").filter(Boolean));
    return entries.length > 0 && entries.every(entry => entry.startsWith("100644 blob "));
  } catch {
    return false;
  }
}

const skip = shouldSkipPreview();
console.log(skip ? "Skipping prose-only preview; production and runtime-input changes still build." : "Continuing build.");
process.exitCode = skip ? 0 : 1;
