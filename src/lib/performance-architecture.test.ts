import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** Every file a module statically imports (value imports only), resolved like the app's aliases. */
function clientImportGraph(entry: string) {
  const seen = new Set<string>();
  const resolveSpec = (from: string, spec: string) => {
    const base = spec.startsWith("@/") ? join(process.cwd(), "src", spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
    if (!base) return null;
    return [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`].find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
  };
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.(ts|tsx|mjs|js)$/.test(file)) return;
    for (const match of readFileSync(file, "utf8").matchAll(/^\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/gm)) {
      const next = resolveSpec(file, match[1]);
      if (next) walk(next);
    }
  };
  walk(join(process.cwd(), entry));
  return [...seen].map((file) => file.replace(`${process.cwd()}/`, ""));
}

describe("serverless performance boundaries", () => {
  it("keeps the public shell and landing page free of server-side auth", () => {
    expect(source("src/app/layout.tsx")).not.toContain("@/lib/supabase/server");
    expect(source("src/app/layout.tsx")).not.toContain("getClaims(");
    expect(source("src/app/page.tsx")).not.toContain("@/lib/supabase/server");
    expect(source("src/app/page.tsx")).not.toContain("getClaims(");
  });

  it("runs session middleware only on auth-sensitive routes", () => {
    expect(config.matcher).toEqual([
      // Source-map denial runs before static serving (see src/proxy.ts).
      "/_next/static/:path(.*(?:\\.|%2[eE])(?:m|%6[dD])(?:a|%61)(?:p|%70))",
      "/account/:path*",
      "/dashboard/:path*",
      "/pricing",
      "/pricing/preview",
      "/login",
      "/auth/:path*",
      "/api/((?!assets/free$).*)",
    ]);
  });

  it("keeps the cacheable free asset route out of session middleware", () => {
    const api = config.matcher.at(-1)!;
    const pattern = new RegExp(`^${api.replace("/api/", "\\/api\\/")}$`);
    expect(pattern.test("/api/assets/free")).toBe(false);
    expect(pattern.test("/api/assets/sign")).toBe(true);
    expect(pattern.test("/api/study-state")).toBe(true);
    expect(pattern.test("/api/assets/free-extra")).toBe(true);
  });

  it("pre-renders bank pages instead of doing corpus and auth work per request", () => {
    const page = source("src/app/banks/[slug]/page.tsx");
    expect(page).not.toContain('from "next/headers"');
    expect(page).not.toContain('from "@/lib/supabase/server"');
    expect(page).not.toContain("searchParams:");
    expect(page).toContain("export const dynamicParams = false");
    expect(page).toContain("bootstrapUrl=");
  });

  it("preconnects bank pages to the hosts that serve question images", () => {
    const page = source("src/app/banks/[slug]/page.tsx");
    expect(page).toMatch(/for \(const origin of assetOriginsForBank\(slug\)\) preconnect\(origin/);
  });

  it("does not eagerly import every question bank into the shared question module", () => {
    const questions = source("src/lib/questions.ts");
    expect(questions).not.toContain("@/data/raw/");
    expect(questions).not.toContain("const rawBanks");
  });

  it("keeps server-only classification ledgers out of the bank explorer bundle", () => {
    const graph = clientImportGraph("src/components/QuestionExplorer.tsx");
    expect(graph).toContain("src/lib/taxonomy-router.ts");
    expect(graph).not.toContain("src/data/igcse-0580-section-retrieval-v3.json");
    expect(graph).not.toContain("src/data/classification/igcse-biology-0610-official-taxonomy-v2.json");
  });

  it("keeps PDF generation out of the cold explorer entry chunk", () => {
    const explorer = source("src/components/QuestionExplorer.tsx");
    expect(explorer).not.toMatch(/^import\s+(?!type\b).*from [\"']@\/lib\/pdf-export[\"']/m);
    expect(explorer).toContain('import("@/lib/pdf-export")');
  });

  it("gives bank navigation its own accessible loading boundary", () => {
    const loading = source("src/app/banks/[slug]/loading.tsx");
    expect(loading).toContain('aria-label="Loading question bank"');
    expect(loading).toContain("bank-loading-workspace");
  });

  it("keeps bank route delivery bounded to the first matching page", () => {
    const page = source("src/app/banks/[slug]/page.tsx");
    expect(page).not.toContain("prepareQuestionsForDelivery");
    expect(page).toContain("const filterableQuestions = allQuestions.map");
    expect(page).toContain("mergeQuestionRichDetails");
    expect(page).toMatch(/const initialQuestions = initialMatches\.slice\(0, EXPLORER_PAGE_SIZE\)/);
  });
});
