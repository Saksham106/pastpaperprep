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

  it("scopes proxy work to auth-sensitive routes and static privacy fences", () => {
    expect(config.matcher).toEqual([
      // Local-fixture denial runs before both static serving and session work.
      "/dev-explanations/:path*",
      "/:path((?:d|%64)(?:e|%65)(?:v|%76)(?:-|%2[dD])(?:e|%65)(?:x|%78)(?:p|%70)(?:l|%6[cC])(?:a|%61)(?:n|%6[eE])(?:a|%61)(?:t|%74)(?:i|%69)(?:o|%6[fF])(?:n|%6[eE])(?:s|%73)(?:(?:/|%2[fF]).*)?)",
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

  const EXPLORER_ROUTES = ["src/app/banks/[slug]/page.tsx", "src/app/banks/[slug]/topics/[topicSlug]/page.tsx", "src/app/banks/[slug]/papers/[paperSlug]/page.tsx"];

  it("pre-renders bank, topic, and paper pages instead of doing corpus and auth work per request", () => {
    for (const route of EXPLORER_ROUTES) {
      const page = source(route);
      expect(page).not.toContain('from "next/headers"');
      expect(page).not.toContain('from "@/lib/supabase/server"');
      expect(page).not.toContain("searchParams:");
      expect(page).toContain("export const dynamicParams = false");
      expect(page).toContain("loadBankExplorer(");
      expect(page).toContain("<BankQuestionExplorer");
    }
    expect(source("src/components/BankQuestionExplorer.tsx")).toContain("bootstrapUrl=");
  });

  it("preconnects explorer pages to the hosts that serve question images", () => {
    expect(source("src/components/BankQuestionExplorer.tsx")).toMatch(/for \(const origin of assetOriginsForBank\(slug\)\) preconnect\(origin/);
  });

  it("does not eagerly import every question bank into the shared question module", () => {
    const questions = source("src/lib/questions.ts");
    expect(questions).not.toContain("@/data/raw/");
    expect(questions).not.toContain("const rawBanks");
  });

  it("keeps the hot asset routes free of the full question corpus", () => {
    for (const route of ["src/app/api/assets/sign/route.ts", "src/app/api/assets/free/route.ts", "src/app/api/study-state/route.ts"]) {
      const graph = clientImportGraph(route);
      expect(graph, route).toContain("src/lib/asset-manifest.ts");
      expect(graph, route).not.toContain("src/lib/question-loader.ts");
      expect(graph.some((file) => file.startsWith("src/data/raw/") || file.startsWith("src/data/production/")), route).toBe(false);
    }
  });

  it("reads asset manifests from a constant path so file tracing stays bounded", () => {
    const manifest = source("src/lib/asset-manifest.ts");
    expect(manifest).toContain('join(process.cwd(), "generated", "asset-manifest", assetManifestFileName(slug))');
    expect(manifest).not.toMatch(/join\(directory/);
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
    const page = source("src/lib/bank-explorer.ts");
    expect(page).not.toContain("prepareQuestionsForDelivery");
    expect(page).toContain("const filterableQuestions = allQuestions.map");
    expect(page).toContain("mergeQuestionRichDetails");
    expect(page).toMatch(/const initialQuestions = initialMatches\.slice\(0, EXPLORER_PAGE_SIZE\)/);
  });
});
