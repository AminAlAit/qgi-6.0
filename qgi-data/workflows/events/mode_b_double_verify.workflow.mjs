export const meta = {
  name: 'qgi-mode-b-double-verify',
  description: 'Blind independent verification passes for events below verify_count 2 (or needing a tiebreak)',
  whenToUse: 'Founder trigger "double-verify a batch" / "double-verify next N" / "double-verify {country}". args MUST be the plan JSON from: node qgi-data/workflows/events/_lib.mjs plan-b [--country slug] [--batch N]',
  phases: [
    { title: 'Verify', detail: 'one blind verifier per needed pass, 10 in flight' },
  ],
}

// Agent-orchestration ONLY: selection came from plan-b (deterministic), and
// append/consensus/write-back happen afterwards in deterministic code:
//   node qgi-data/workflows/events/_lib.mjs consolidate-b --plan <plan> --results <this return value>
// Verifiers are blind: each job's prompt embeds ONLY {year,title,description,category}
// plus prior passes' registrable source DOMAINS (independence rule) — never a prior
// verdict, reason, or direction. Fleet fixed at claude-sonnet-5 via model:'sonnet'.

const plan = args
if (!plan || plan.mode !== 'B' || !Array.isArray(plan.batch)) {
  throw new Error('args must be the plan JSON produced by: node _lib.mjs plan-b')
}

phase('Verify')
log(`verifying ${plan.batch.length} events (${plan.batch.reduce((n, e) => n + e.passesNeeded, 0)} passes)`)

// compose each blind prompt from the single template + per-event fields.
// Replacer FUNCTION, not string replacement: event text can contain $-sequences
// ($$, $&, $') that a plain .replace would expand and corrupt the prompt.
const fill = (template, replacements) => {
  let out = template
  for (const [placeholder, value] of Object.entries(replacements)) {
    out = out.replace(placeholder, () => value)
  }
  return out
}
const promptFor = (e) => fill(plan.verifyPromptTemplate, {
  __COUNTRY__: e.slug,
  __EVENT_JSON__: e.eventJson,
  __PRIOR_DOMAINS__: e.priorDomains,
  __WHY__: e.why,
})

// flatten: one job per needed pass (zero-verdict events need two fresh blind passes)
const jobs = plan.batch.flatMap((e) =>
  Array.from({ length: e.passesNeeded }, (_, i) => ({ e, prompt: promptFor(e), passIdx: i + 1 })))

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      try { results[i] = await fn(items[i], i) } catch (err) { results[i] = null }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return results
}

const results = await mapLimit(jobs, plan.caps.VERIFIER_CONCURRENCY_B, async ({ e, prompt, passIdx }) => {
  const pass = await agent(prompt, {
    schema: plan.schemas.verify, model: 'sonnet',
    label: `verify:${e.slug}:${e.year}:${passIdx}`, phase: 'Verify',
  })
  if (!pass) return null
  return { key: e.key, slug: e.slug, year: e.year, title: e.title, pass }
})

const ok = results.filter(Boolean)
log(`completed ${ok.length}/${jobs.length} verification passes`)

return { mode: 'B', results: ok }
