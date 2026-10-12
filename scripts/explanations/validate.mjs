#!/usr/bin/env node
// Validates explanation JSON files against SPEC.md: structure, mark totals and KaTeX-renderable maths.
// Usage: node scripts/explanations/validate.mjs <file.json> [...more] | --manifest <manifest.json>
// Exit code 1 if any file fails. Prints one JSON line per file.
import { existsSync, readFileSync } from "node:fs";
import katex from "katex";

const MARK_CODE = /^(\(?(M|A|R|B|N|SC|AG|E|C|P|S|G)\d*\)?( ?\(?dep\)?)?|✓)$/;
const LABEL = /^([a-z](\([ivx]+\))?)?$/;

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
      if (!Array.isArray(step.marks)) errors.push(`${sat}: marks must be an array`);
      else for (const code of step.marks) if (typeof code !== "string" || !MARK_CODE.test(code)) errors.push(`${sat}: bad mark code "${code}"`);
    });
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
    jobs = argv.map((file) => ({ file, expected: {} }));
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
