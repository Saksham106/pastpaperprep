// Run from the repo with: node scripts/qa-theme-contrast.mjs
// Optional: THEME_QA_BASE_URL=http://127.0.0.1:3100 THEME_QA_SPACE_ID=74 THEME_QA_ACCOUNT_PREVIEW=/dev/account-preview?view=complimentary
// axe-core checks rendered text in both modes; image/gradient/pseudo-element backgrounds
// can be inconclusive and need screenshot review. Root overflow does not detect clipped
// nested containers; inspect those visually. The dev-only account preview is optional.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const axe = readFileSync(path.join(process.cwd(), "node_modules/axe-core/axe.min.js"), "utf8");
const settings = {
  base: process.env.THEME_QA_BASE_URL ?? "http://127.0.0.1:3100",
  spaceId: process.env.THEME_QA_SPACE_ID ? Number(process.env.THEME_QA_SPACE_ID) : null,
  preview: process.env.THEME_QA_ACCOUNT_PREVIEW ?? null,
};
const source = `const settings = ${JSON.stringify(settings)};\nconst axe = ${JSON.stringify(axe)};\n` + String.raw`
const task = await taskSpace(settings.spaceId ?? "PastPaperPrep theme contrast QA");
const page = task.page("p1");
// Inspect settled colors instead of measuring halfway through an entrance animation.
await page.cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const routes = ["/", "/pricing", "/articles", "/articles/topic-questions-vs-full-past-papers", "/faq", "/about", "/login", "/terms", "/privacy", "/refund-policy", "/cambridge-igcse", "/ib", "/syllabus/igcse", "/banks/igcse?free=1", "/banks/igcse/papers/paper-1", "/banks/igcse/topics/number", "/banks/ib-hl/exam-style/proof-by-induction", "/banks/ib-sl/exam-style/trigonometry"];
if (settings.preview) routes.push(settings.preview);
let failures = 0;
for (const theme of ["dark", "light"]) {
  await page.goto(settings.base);
  await page.evaluate(value => window.localStorage.setItem("pastpaperprep-theme", value), theme);
  for (const route of routes) {
    try {
      await page.goto(settings.base + route);
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme, { timeout: 10_000 });
      await page.cdp("Runtime.evaluate", { expression: axe });
      const result = await page.evaluate(async () => {
        const audit = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] } });
        return {
          theme: document.documentElement.dataset.theme,
          rootOverflow: document.documentElement.scrollWidth > innerWidth,
          violations: audit.violations.flatMap(rule => rule.nodes.map(node => ({ target: node.target.join(" "), reason: node.failureSummary }))),
          inconclusive: audit.incomplete.reduce((total, rule) => total + rule.nodes.length, 0),
        };
      });
      if (result.theme !== theme || result.rootOverflow || result.violations.length) failures += 1;
      console.log(JSON.stringify({ theme, route, ...result }));
    } catch (error) {
      failures += 1;
      console.error(JSON.stringify({ theme, route, error: String(error) }));
    }
  }
}
console.log(JSON.stringify({ routesPerTheme: routes.length, failures, note: "Inconclusive nodes need manual screenshot review." }));
if (!settings.spaceId) await task.finish({ keep: [] });
if (failures) throw Error("Theme contrast or overflow checks failed");
`;
const result = spawnSync("ego-browser", ["nodejs"], { input: source, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 300_000 });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
