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

// An agent that dies (rate limit, empty result) is retried, first at once and then once more after the main run.
const deferred = []
async function run(prompt, opts, attempts = 2) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const r = await agent(prompt, attempt ? { ...opts, label: `${opts.label} r${attempt}` } : opts)
    if (r && Array.isArray(r.results) && r.results.length) return r
  }
  return null
}

// Fixes and re-checks are pooled per job and sent in full batches, instead of one small agent per verify chunk.
// Pools are per job so each agent stays single-bank (the ledger reads the bank from the label).
const FIX_BATCH = 8
const REVERIFY_BATCH = 10
const pools = new Map()
const pool = (job) => pools.get(job) ?? pools.set(job, { fix: [], reverify: [], n: 0 }).get(job)

async function fixBatch(job, items) {
  const label = `fix ${job.bank} f${pool(job).n++}`
  const prompt = fixPrompt(idsRef(job, items.map(v => v.questionId)), JSON.stringify(items.map(v => ({ questionId: v.questionId, verdict: v.verdict, issues: v.issues })), null, 1))
  const opts = { label, phase: 'Fix', schema: FIX_SCHEMA, ...cfg(job, 'fix') }
  const r = await run(prompt, opts)
  if (!r) { deferred.push({ job, kind: 'fix', items, prompt, opts }); return }
  await queueReverify(job, items.filter(isCritical).map(v => v.questionId))
}
async function reverifyBatch(job, ids) {
  const opts = { label: `re-verify ${job.bank} r${pool(job).n++}`, phase: 'Re-verify', schema: VERIFY_SCHEMA, ...cfg(job, 'verify') }
  const prompt = verifyPrompt(idsRef(job, ids))
  if (!(await run(prompt, opts))) deferred.push({ job, kind: 'reverify', ids, prompt, opts })
}
async function queueFix(job, items, flush = false) {
  const p = pool(job)
  p.fix.push(...items)
  while (p.fix.length >= FIX_BATCH || (flush && p.fix.length)) await fixBatch(job, p.fix.splice(0, FIX_BATCH))
}
async function queueReverify(job, ids, flush = false) {
  const p = pool(job)
  p.reverify.push(...ids)
  while (p.reverify.length >= REVERIFY_BATCH || (flush && p.reverify.length)) await reverifyBatch(job, p.reverify.splice(0, REVERIFY_BATCH))
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
    const opts = { label: `fix ${tag}`, phase: 'Fix', schema: FIX_SCHEMA, ...cfg(job, 'fix') }
    const prompt = fixPrompt(planRef(job, 'fix', k), `(The issues are in the plan file's "fix" chunk ${k}, as the "issues" array of each entry.)`)
    const r = await run(prompt, opts)
    if (!r) { deferred.push({ job, kind: 'planfix', prompt, opts }); return }
    await queueReverify(job, r.results.filter(x => x.hadCriticalIssue).map(x => x.questionId))
    return
  }
  if (stage === 'generate') {
    const opts = { label: `generate ${tag}`, phase: 'Generate', schema: GEN_SCHEMA, ...cfg(job, 'gen') }
    const g = await run(genPrompt(planRef(job, 'generate', k)), opts)
    // Unwritten drafts are left for the next run's ledger; checking them now would only fail.
    if (!g || !g.results.some(r => r.written)) { log(`generate ${tag} wrote nothing; its questions stay in the next plan`); return }
  }
  const opts = { label: `verify ${tag}`, phase: 'Verify', schema: VERIFY_SCHEMA, ...cfg(job, 'verify') }
  const v = await run(verifyPrompt(planRef(job, stage, k)), opts)
  if (!v) { deferred.push({ job, kind: 'verify', prompt: verifyPrompt(planRef(job, stage, k)), opts }); return }
  await queueFix(job, v.results.filter(needsFix))
})

// Last call for retries, then send the part-filled pools.
for (const d of deferred.splice(0)) {
  const r = await run(d.prompt, { ...d.opts, label: `${d.opts.label} late` }, 1)
  if (!r) { log(`gave up: ${d.opts.label}`); continue }
  if (d.kind === 'verify') await queueFix(d.job, r.results.filter(needsFix))
  if (d.kind === 'fix') await queueReverify(d.job, d.items.filter(isCritical).map(v => v.questionId))
  if (d.kind === 'planfix') await queueReverify(d.job, r.results.filter(x => x.hadCriticalIssue).map(x => x.questionId))
}
await parallel(args.jobs.map(job => () => queueFix(job, [], true)))
await parallel(args.jobs.map(job => () => queueReverify(job, [], true)))
if (deferred.length) log(`gave up on ${deferred.length} agents after retries: ${deferred.map(d => d.opts.label).join(', ')}`)
log('Done. Rebuild ledgers with scripts/explanations/ledger-from-journal.mjs using this run\'s journal.')
return { items: items.length }
