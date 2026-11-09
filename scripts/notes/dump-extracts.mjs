// Every line of a course that a student reads on its own, out of its lesson: cheat-sheet facts and formulas, topic
// "which method when" lines, glossary definitions, exam tips, mistakes and command terms. The extracts audit reads this
// dump with no lesson open, the way a student revising from the cheat sheet would (docs/course-notes/process-v3.md).
//
//   node scripts/notes/dump-extracts.mjs --course <slug> [--topic <n>] > extracts.md
//
// Each line is printed with the file and JSON path to edit, so a fix can be made in place.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { courseFiles, parseCourseArg } from "./course.mjs";

const { slug, rest } = parseCourseArg(process.argv.slice(2));
const topicArg = rest.indexOf("--topic");
const onlyTopic = topicArg >= 0 ? Number(rest[topicArg + 1]) : null;
const course = courseFiles(slug);
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const list = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".json")).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : []);
const out = [`# Standalone lines: ${slug}${onlyTopic ? `, topic ${onlyTopic}` : ""}`, ""];
const line = (where, text, level) => out.push(`- \`${where}\`${level ? ` [${level}]` : ""}: ${String(text).replace(/\s+/g, " ")}`);

for (const name of list(course.lessonsDir)) {
  const lesson = read(join(course.lessonsDir, name));
  if (onlyTopic && lesson.topic !== onlyTopic) continue;
  const file = `lessons/${name}`;
  out.push(`## ${lesson.item} ${lesson.title} (${lesson.level})`, "");
  lesson.sections.forEach((section, s) =>
    section.blocks.forEach((block, b) => {
      const level = block.level ?? section.level;
      if (block.type === "fact" && block.cheatSheet) line(`${file} sections[${s}].blocks[${b}].text`, block.text, level);
      if (block.type === "formula" && block.cheatSheet) line(`${file} sections[${s}].blocks[${b}].tex`, `$${block.tex}$`, level);
      if (section.id === "takeaways" && block.type === "text") line(`${file} sections[${s}].blocks[${b}].text`, block.text, level);
    }),
  );
  lesson.examTips.forEach((text, i) => line(`${file} examTips[${i}]`, `Exam tip: ${text}`));
  lesson.mistakes.forEach((text, i) => line(`${file} mistakes[${i}]`, `Mistake: ${text}`));
  const glossaryFile = join(course.root, "glossary", name);
  if (existsSync(glossaryFile)) read(glossaryFile).forEach((term, i) => line(`glossary/${name} [${i}].definition`, `**${term.term}**: ${term.definition}`));
  out.push("");
}
if (!onlyTopic) {
  for (const name of list(join(course.root, "cheatsheets"))) {
    out.push(`## Topic sheet ${name}`, "");
    read(join(course.root, "cheatsheets", name)).lines.forEach((entry, i) => line(`cheatsheets/${name} lines[${i}].text`, entry.text, entry.level));
    out.push("");
  }
  const terms = join(course.root, "command-terms.json");
  if (existsSync(terms)) {
    out.push("## Command terms", "");
    read(terms).forEach((term, i) => line(`command-terms.json [${i}].definition`, `**${term.term}**: ${term.definition}`));
  }
}
process.stdout.write(`${out.join("\n")}\n`);
