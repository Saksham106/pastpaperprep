import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
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
      "/account/:path*",
      "/dashboard/:path*",
      "/banks/:path*",
      "/pricing",
      "/login",
      "/auth/:path*",
      "/api/:path*",
    ]);
  });

  it("does not eagerly import every question bank into the shared question module", () => {
    const questions = source("src/lib/questions.ts");
    expect(questions).not.toContain("@/data/raw/");
    expect(questions).not.toContain("const rawBanks");
  });
});
