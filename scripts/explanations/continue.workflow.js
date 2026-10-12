export const meta = {
  name: 'explanations-continue',
  description: 'Finish interrupted explanation runs: write missing explanations, verify unchecked ones, fix and re-verify',
  phases: [
    { title: 'Generate', detail: 'write missing explanation JSON from question + mark scheme images' },
    { title: 'Verify', detail: 'fresh agents solve blind, then check against the mark scheme' },
    { title: 'Fix', detail: 'repair explanations with issues' },
    { title: 'Re-verify', detail: 'fresh check of repaired explanations with critical issues' },
  ],
}

const REPO = '/Users/sakshamgoel/Documents/ProjectsInternships/pastpaperprep/.worktrees/question-explanations'
const SPEC = REPO + '/scripts/explanations/SPEC.md'
const VALIDATE = REPO + '/scripts/explanations/validate.mjs'

const GEN_SCHEMA = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: {
  questionId: { type: 'string' }, written: { type: 'boolean' }, validatorPassed: { type: 'boolean' }, needsReview: { type: 'boolean' }, note: { type: 'string' },
}, required: ['questionId', 'written', 'validatorPassed', 'needsReview', 'note'] } } }, required: ['results'] }
const ISSUE = { type: 'object', properties: { severity: { type: 'string', enum: ['critical', 'minor'] }, part: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'part', 'problem', 'fix'] }
const VERIFY_SCHEMA = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: {
  questionId: { type: 'string' }, verdict: { type: 'string', enum: ['pass', 'fix', 'fail'] }, quality: { type: 'integer', minimum: 1, maximum: 5 }, issues: { type: 'array', items: ISSUE },
}, required: ['questionId', 'verdict', 'quality', 'issues'] } } }, required: ['results'] }
const FIX_SCHEMA = { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: {
  questionId: { type: 'string' }, fixed: { type: 'boolean' }, validatorPassed: { type: 'boolean' }, hadCriticalIssue: { type: 'boolean' }, note: { type: 'string' },
}, required: ['questionId', 'fixed', 'validatorPassed', 'hadCriticalIssue', 'note'] } } }, required: ['results'] }

const idsRef = (job, ids) => `Task manifest: ${job.manifest}. Your tasks are the manifest entries (tasks[]) with these questionId values: ${JSON.stringify(ids)}.`
const planRef = (job, stage, k) => `Task manifest: ${job.manifest}. Plan file: ${job.planFile}. Your tasks are chunk ${k} (zero-based) of the plan's "${stage}" array; look each questionId up in the manifest's tasks[].`

const genPrompt = (ref) => `You are writing worked explanations for exam questions on PastPaperPrep.

1. Read the writing spec in full: ${SPEC}
2. ${ref}
3. For each task, in turn:
   - Read EVERY question image and EVERY mark scheme image with the Read tool. The images are the source of truth; the extracted text is often scrambled.
   - Mark scheme pages may include other questions. Use only the rows for this question number.
   - Write the explanation JSON to the task's outputPath. Follow the spec exactly.
   - Run: node ${VALIDATE} <outputPath>   Fix every error and re-run until it passes.
4. Do not edit any file other than your outputPath files. Do not touch Git.

Return one result per task.`

const verifyPrompt = (ref) => `You are an independent checker of worked explanations for IB / IGCSE exam questions. Be strict: students pay for these and a wrong explanation is worse than none.

Spec the explanations must follow: ${SPEC}
${ref}

For each task:
1. Read EVERY question image. Before opening the explanation, solve each part yourself and note your final answer.
2. Read EVERY mark scheme image (only the rows for this question number). Note the scheme's final answers and mark codes per part.
3. Read the explanation JSON at the task's outputPath and check:
   - Part labels and marks match the printed paper; nothing missing or invented.
   - Each part's final answer matches the scheme (exact form / accuracy the scheme accepts).
   - Every step is mathematically correct and follows from the previous one. "Show that" parts genuinely reach the given result.
   - Mark codes match the scheme's main method and sit on the right steps.
   - It explains the reasoning clearly and briefly, does not copy the scheme's wording, and has no invented content.
4. Verdict: "pass" = correct and good enough to show students; "fix" = correct answers but has issues worth fixing; "fail" = any wrong final answer, wrong part structure, or a mathematically false step.
   Critical issue = anything that would make a student learn something wrong or lose marks. Minor = clarity/style.
   quality: 5 = excellent tutor-level, 3 = acceptable, 1 = unusable.
Do not edit any files. Return one result per task.`

const fixPrompt = (ref, issuesText) => `You are repairing worked explanations for exam questions on PastPaperPrep.

Spec: ${SPEC} (read it in full).
${ref}

An independent checker found these issues:
${issuesText}

For each task: read EVERY question image and EVERY mark scheme image again, confirm each issue against the images (the checker can be wrong too; if an issue is not real, leave that part unchanged and say so in note), fix the real ones in the JSON at the task's outputPath, then run node ${VALIDATE} <outputPath> until it passes. If you cannot make the explanation correct, set top-level "status": "needs_review" with a "reviewNote". Set hadCriticalIssue to true when the checker's issues for that task included a critical one or its verdict was "fail".
Do not edit any other file. Do not touch Git. Return one result per task.`

const needsFix = (v) => v && (v.verdict !== 'pass' || v.issues.some(i => i.severity === 'critical'))
const isCritical = (v) => v && (v.verdict === 'fail' || v.issues.some(i => i.severity === 'critical'))

// Per-job model/effort by role: job.genModel, job.genEffort, job.fixModel, job.fixEffort,
// job.verifyModel, job.verifyEffort. Unset model inherits the session model; effort defaults to high.
const cfg = (job, role) => {
  const model = job[role + 'Model']
  const effort = job[role + 'Effort'] || 'high'
  return model ? { model, effort } : { effort }
}

async function repair(job, tag, verified) {
  const toFix = verified.filter(needsFix)
  if (!toFix.length) return
  await agent(fixPrompt(idsRef(job, toFix.map(v => v.questionId)), JSON.stringify(toFix.map(v => ({ questionId: v.questionId, verdict: v.verdict, issues: v.issues })), null, 1)),
    { label: `fix ${tag}`, phase: 'Fix', schema: FIX_SCHEMA, ...cfg(job, 'fix') })
  const crit = toFix.filter(isCritical).map(v => v.questionId)
  if (crit.length) await agent(verifyPrompt(idsRef(job, crit)), { label: `re-verify ${tag}`, phase: 'Re-verify', schema: VERIFY_SCHEMA, ...cfg(job, 'verify') })
}

const items = []
for (const job of args.jobs) {
  for (let k = 0; k < job.generate; k++) items.push({ job, stage: 'generate', k })
  for (let k = 0; k < job.verify; k++) items.push({ job, stage: 'verify', k })
  for (let k = 0; k < job.fix; k++) items.push({ job, stage: 'fix', k })
}

await pipeline(items, async (it) => {
  const { job, stage, k } = it
  const tag = `${job.bank} ${stage[0]}${k}`
  if (stage === 'fix') {
    const r = await agent(fixPrompt(planRef(job, 'fix', k), `(The issues are in the plan file's "fix" chunk ${k}, as the "issues" array of each entry.)`), { label: `fix ${tag}`, phase: 'Fix', schema: FIX_SCHEMA, ...cfg(job, 'fix') })
    const crit = r ? r.results.filter(x => x.hadCriticalIssue).map(x => x.questionId) : []
    if (crit.length) await agent(verifyPrompt(idsRef(job, crit)), { label: `re-verify ${tag}`, phase: 'Re-verify', schema: VERIFY_SCHEMA, ...cfg(job, 'verify') })
    return
  }
  if (stage === 'generate') await agent(genPrompt(planRef(job, 'generate', k)), { label: `generate ${tag}`, phase: 'Generate', schema: GEN_SCHEMA, ...cfg(job, 'gen') })
  const v = await agent(verifyPrompt(planRef(job, stage, k)), { label: `verify ${tag}`, phase: 'Verify', schema: VERIFY_SCHEMA, ...cfg(job, 'verify') })
  if (v) await repair(job, tag, v.results)
})
log('Done. Rebuild ledgers with scripts/explanations/ledger-from-journal.mjs using this run\'s journal.')
return { items: items.length }
