#!/usr/bin/env node

// Vercel's ignoreCommand exits 0 to SKIP, 1 to BUILD.
// On Pro every build is billed by CPU minute, and CI's `build` job already runs the full
// production build on every PR. So Git preview deployments are opt-in: they build only when the
// pushed head commit's message contains "[preview]" (e.g. `git commit --allow-empty -m "[preview]"`).
// Production, and deployments without Git metadata (`vercel deploy` from the CLI), always build.
export function shouldSkipBuild(env = process.env) {
  if (env.VERCEL_ENV !== "preview") return false;
  if (!env.VERCEL_GIT_COMMIT_SHA) return false;
  return !/\[preview\]/i.test(env.VERCEL_GIT_COMMIT_MESSAGE ?? "");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const skip = shouldSkipBuild();
  console.log(skip
    ? "Skipping Git preview build: CI builds every PR. Push a commit whose message contains [preview] to get a preview deployment."
    : "Continuing build.");
  process.exitCode = skip ? 0 : 1;
}
