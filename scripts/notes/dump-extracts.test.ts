import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve(process.cwd(), "scripts/notes/dump-extracts.mjs");

describe("dump-extracts.mjs", () => {
  it("lists a course's standalone lines with the file and path to edit", () => {
    const run = spawnSync(process.execPath, [script, "--course", "igcse-maths-0580", "--topic", "1"], { encoding: "utf8", timeout: 60_000 });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^## 1\.1 /m);
    expect(run.stdout).toMatch(/^- `lessons\/1-1\.json examTips\[0\]`: Exam tip: /m);
    expect(run.stdout).toMatch(/^- `glossary\/1-1\.json \[0\]\.definition`: \*\*/m);
    expect(run.stdout).not.toMatch(/^## 2\.1 /m);
  });

  it("includes inline examTip and mistake blocks, which hold text found nowhere else", () => {
    const lesson = JSON.parse(readFileSync(resolve(process.cwd(), "src/content/notes/ib-physics/lessons/1-1.json"), "utf8"));
    const inline = lesson.sections.flatMap((section: { blocks: { type: string; text?: string }[] }, s: number) => section.blocks.map((block, b) => ({ ...block, path: `sections[${s}].blocks[${b}].text` }))).filter((block: { type: string }) => block.type === "mistake" || block.type === "examTip");
    expect(inline.length).toBeGreaterThan(0);
    const run = spawnSync(process.execPath, [script, "--course", "ib-physics", "--topic", "1"], { encoding: "utf8", timeout: 60_000 });
    for (const block of inline) expect(run.stdout).toContain(`\`lessons/1-1.json ${block.path}\`: ${block.type === "mistake" ? "Mistake" : "Exam tip"}: `);
  });

  it("with --topic, keeps that topic's cheat sheet and leaves out the others and the command terms", () => {
    const run = spawnSync(process.execPath, [script, "--course", "igcse-maths-0580", "--topic", "1"], { encoding: "utf8", timeout: 60_000 });
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "src/content/notes/igcse-maths-0580/course.json"), "utf8"));
    const own = config.topics.find((topic: { n: number }) => topic.n === 1).slug;
    expect(run.stdout).toContain(`## Topic sheet ${own}.json`);
    expect(run.stdout).toMatch(new RegExp(`^- \`cheatsheets/${own}\\.json lines\\[0\\]\\.text\``, "m"));
    expect(run.stdout.match(/^## Topic sheet /gm)).toHaveLength(1);
    expect(run.stdout).not.toContain("## Command terms");
  });
});
