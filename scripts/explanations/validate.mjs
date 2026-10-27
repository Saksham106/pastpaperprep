#!/usr/bin/env node
// Validates explanation JSON files against SPEC.md: structure, mark totals and KaTeX-renderable maths.
// Usage: node scripts/explanations/validate.mjs <file.json> [...more] | --manifest <manifest.json>
// Exit code 1 if any file fails. Prints one JSON line per file.
import { existsSync, readFileSync } from "node:fs";
import katex from "katex";

const MARK_CODE = /^(\(?(M|A|R|B|N|SC|AG|E|C|P|S|G|L)\d*\)?( ?\(?dep\)?)?|✓)$/;
const SCIENCE = /^(igcse-(biology|chemistry|physics|coordinated-sciences)-|ib-(biology|chemistry|physics)-)/;
// Cambridge papers number some sub-subparts, "(c)(ii) 1." and "2.", each with its own printed marks: label "c(ii)1";
// others letter them, "(b)(ii)(a)" and "(b)": label "b(ii)(a)". Older papers number parts with bare numerals, "(i)" and "(ii)": label "ii".
const LABEL = /^([a-z](\([ivx]+\)([1-9]|\([a-z]\))?)?|[ivx]+)?$/;

// Marks carried by a part's codes. AG and SC carry none. Science schemes (Cambridge and IB) may number their marking
// points M1, M2, ...: when a science part's M codes are exactly M1..Mk, each is one mark, not a weighted method mark.
// In maths, M1 then M2 are separate method marks worth 1 and 2.
// Ticks are counted separately: an "any n from" list may tick more alternatives than the part is worth.
export function codeTotals(codes, { science = false } = {}) {
  const ms = codes.map((c) => /^\(?M(\d+)\)?$/.exec(c)?.[1]).filter(Boolean).map(Number);
  const points = science && ms.length > 1 && ms.every((n, i) => n === i + 1);
  let coded = 0;
  let ticks = 0;
  for (const code of codes) {
    if (code === "✓") { ticks += 1; continue; }
    const m = /^\(?(AG|SC|M|A|R|B|N|E|C|P|S|G|L)(\d*)/.exec(code);
    if (!m || m[1] === "AG" || m[1] === "SC") continue;
    coded += m[1] === "M" && points ? 1 : m[2] === "" ? 1 : Number(m[2]);
  }
  return { coded, ticks };
}

function renderErrors(str, where) {
  const errors = [];
  if (typeof str !== "string") return errors;
  const parts = str.split(/(?<!\\)\$/);
  if (parts.length % 2 === 0) errors.push(`${where}: unbalanced $`);
  for (let i = 1; i < parts.length; i += 2) {
    try { katex.renderToString(parts[i], { throwOnError: true, strict: "ignore" }); }
    catch (e) { errors.push(`${where}: KaTeX "${parts[i].slice(0, 60)}" ${String(e.message).slice(0, 120)}`); }
  }
  return errors;
}

function displayErrors(tex, where) {
  try { katex.renderToString(tex, { throwOnError: true, displayMode: true, strict: "ignore" }); return []; }
  catch (e) { return [`${where}: KaTeX display "${tex.slice(0, 60)}" ${String(e.message).slice(0, 120)}`]; }
}

export function validateExplanation(doc, expected = {}) {
  const errors = [];
  if (doc.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (expected.bank && doc.bank !== expected.bank) errors.push(`bank ${doc.bank} != ${expected.bank}`);
  if (expected.questionId && doc.questionId !== expected.questionId) errors.push(`questionId ${doc.questionId} != ${expected.questionId}`);
  if (!Number.isInteger(doc.totalMarks)) errors.push("totalMarks must be an integer");
  if (expected.marks && doc.totalMarks !== expected.marks) errors.push(`totalMarks ${doc.totalMarks} != printed ${expected.marks}`);
  if (doc.status !== undefined && doc.status !== "needs_review") errors.push("status may only be needs_review");
  if (doc.status === "needs_review" && !doc.reviewNote) errors.push("needs_review requires reviewNote");
  if (!Array.isArray(doc.parts) || doc.parts.length === 0) return [...errors, "parts must be a non-empty array"];

  let sum = 0;
  const labels = new Set();
  doc.parts.forEach((part, i) => {
    const at = `parts[${i}]${part?.label ? ` (${part.label})` : ""}`;
    if (typeof part.label !== "string" || !LABEL.test(part.label)) errors.push(`${at}: bad label "${part.label}"`);
    if (labels.has(part.label)) errors.push(`${at}: duplicate label`);
    labels.add(part.label);
    if (!Number.isInteger(part.marks) || part.marks < 0) errors.push(`${at}: marks must be a non-negative integer`);
    else sum += part.marks;
    for (const key of ["approach", "answer"]) {
      if (typeof part[key] !== "string" || !part[key].trim()) errors.push(`${at}: ${key} required`);
      else errors.push(...renderErrors(part[key], `${at}.${key}`));
    }
    if (part.withdrawn !== undefined && part.withdrawn !== true) errors.push(`${at}: withdrawn may only be true`);
    if (part.mistake !== undefined) {
      if (typeof part.mistake !== "string" || !part.mistake.trim()) errors.push(`${at}: mistake must be non-empty when present`);
      else errors.push(...renderErrors(part.mistake, `${at}.mistake`));
    }
    if (!Array.isArray(part.steps) || part.steps.length < 1 || part.steps.length > 10) {
      errors.push(`${at}: steps must have 1–10 entries`);
      return;
    }
    part.steps.forEach((step, j) => {
      const sat = `${at}.steps[${j}]`;
      if (typeof step.text !== "string" || !step.text.trim()) errors.push(`${sat}: text required`);
      else errors.push(...renderErrors(step.text, `${sat}.text`));
      if (step.math !== undefined) {
        if (typeof step.math !== "string" || !step.math.trim()) errors.push(`${sat}: math must be non-empty when present`);
        else if (/(?<!\\)\$/.test(step.math)) errors.push(`${sat}: math must not contain $`);
        else errors.push(...displayErrors(step.math, `${sat}.math`));
      }
      if (step.code !== undefined) {
        if (typeof step.code !== "string" || !step.code.trim()) errors.push(`${sat}: code must be non-empty when present`);
        else if (/\t/.test(step.code)) errors.push(`${sat}: code must indent with spaces, not tabs`);
      }
      for (const key of Object.keys(step)) if (!["text", "math", "code", "marks"].includes(key)) errors.push(`${sat}: unknown key "${key}"`);
      if (!Array.isArray(step.marks)) errors.push(`${sat}: marks must be an array`);
      else for (const code of step.marks) if (typeof code !== "string" || !MARK_CODE.test(code)) errors.push(`${sat}: bad mark code "${code}"`);
    });
    const codes = part.steps.flatMap((step) => (Array.isArray(step.marks) ? step.marks.filter((c) => typeof c === "string") : []));
    // Level-marked parts carry one level code for the whole part (SPEC 11b).
    // A part the exam board withdrew keeps its printed marks but awards none (SPEC 13b).
    if (part.withdrawn === true && codes.length) errors.push(`${at}: a withdrawn part carries no mark codes`);
    if (Number.isInteger(part.marks) && !part.withdrawn && !codes.some((c) => /^\(?L\d/.test(c))) {
      const { coded, ticks } = codeTotals(codes, { science: SCIENCE.test(doc.bank ?? "") });
      if (coded > part.marks) errors.push(`${at}: mark codes add up to ${coded}, more than the part's ${part.marks} marks`);
      if (coded + ticks < part.marks) errors.push(`${at}: mark codes account for ${coded + ticks} of the part's ${part.marks} marks`);
    }
  });
  if (Number.isInteger(doc.totalMarks) && sum !== doc.totalMarks) errors.push(`part marks sum ${sum} != totalMarks ${doc.totalMarks}`);
  const text = JSON.stringify(doc).toLowerCase();
  if (/mark ?scheme|examiner/.test(text.replace(/"(marks|totalmarks)"/g, ""))) errors.push("text mentions the mark scheme or examiners");
  return errors;
}

function main() {
  const argv = process.argv.slice(2);
  let jobs;
  if (argv[0] === "--manifest") {
    const manifest = JSON.parse(readFileSync(argv[1], "utf8"));
    jobs = manifest.tasks.map((t) => ({ file: t.outputPath, expected: { bank: t.bank, questionId: t.questionId, marks: t.marks } }));
  } else {
    // A file at <research>/<bank>/<questionId>.json must name that bank and question.
    jobs = argv.map((file) => {
      const parts = file.split("/");
      const name = parts.at(-1) ?? "";
      const dir = parts.at(-2) ?? "";
      const bankDir = /^(ib|igcse)[a-z0-9-]*$/.test(dir);
      return { file, expected: bankDir && name.endsWith(".json") ? { bank: dir, questionId: name.slice(0, -5) } : {} };
    });
  }
  let failed = 0;
  for (const { file, expected } of jobs) {
    let errors;
    if (!existsSync(file)) errors = ["missing file"];
    else {
      try { errors = validateExplanation(JSON.parse(readFileSync(file, "utf8")), expected); }
      catch (e) { errors = [`invalid JSON: ${e.message}`]; }
    }
    if (errors.length) failed += 1;
    console.log(JSON.stringify({ file, ok: errors.length === 0, errors }));
  }
  console.log(JSON.stringify({ total: jobs.length, failed }));
  process.exitCode = failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
