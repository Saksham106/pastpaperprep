import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

describe("saved worksheets migration", () => {
  it("creates owner-scoped definitions with RLS and revision control", () => {
    const root = join(process.cwd(), "supabase/migrations");
    const file = readdirSync(root).find((name) => name.endsWith("_saved_worksheets.sql"));
    expect(file).toBeTruthy();
    const sql = readFileSync(join(root, file!), "utf8").toLowerCase();
    expect(sql).toContain("create table if not exists public.saved_worksheets");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("auth.uid() = user_id");
    expect(sql).toContain("revision");
  });
});
