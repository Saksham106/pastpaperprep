// Thin wrapper over the wrangler binary for the Worker tools. Only the CLIs call it, and only after the
// owner has approved the deploy/delete in the session that runs them (see docs/content-ingestion.md).
import { spawn } from "node:child_process";

/** WRANGLER=<binary> overrides; otherwise `npx -y wrangler@4`, as the other scripts do. */
export function wranglerCommand(environment = process.env) {
  return environment.WRANGLER ? [environment.WRANGLER] : ["npx", "-y", "wrangler@4"];
}

/** Runs wrangler and returns its combined output. `input` goes to stdin (used for `secret put`; never logged). */
export function runWrangler(args, { cwd, input } = {}) {
  const [bin, ...prefix] = wranglerCommand();
  return new Promise((resolve, reject) => {
    const child = spawn(bin, [...prefix, ...args], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { out += chunk; });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`wrangler ${args[0]} failed (${code}): ${out.slice(-600)}`))));
    child.stdin.end(input ?? "");
  });
}
