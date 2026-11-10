export const meta = {
  name: 'qgi-mode-a-trend-enrich',
  description: 'Enrich ONE Trend: research events for it across many countries -> curate -> 2x blind verify',
  whenToUse: 'Trend-first Mode A (founder redesign). args MUST be the plan JSON from: node qgi-data/workflows/events/_lib.mjs plan-a-trend [--trend slug]',
  phases: [
    { title: 'Research', detail: 'N web-research agents, each a different country slice, all for the one Trend' },
    { title: 'Curate', detail: 'no-tools dedup + wrong-trend filter, one per (country,year)' },
    { title: 'Verify', detail: 'two independent blind verifiers per curated event' },
  ],
}

// Agent-orchestration ONLY. Selection (which Trend) and all persistence happen in
// deterministic code: node _lib.mjs plan-a-trend  /  merge-a-trend.
// Verifier fleet fixed at claude-sonnet-5 via model:'sonnet'.

const plan = args
if (!plan || plan.mode !== 'A-trend' || !Array.isArray(plan.researchAgents)) {
  throw new Error('args must be the plan JSON produced by: node _lib.mjs plan-a-trend')
}

// replacer-function fill (verbatim insertion — a plain String.replace would expand
// $-sequences in agent/web-derived event text)
const fill = (template, replacements) => {
  let out = template
  for (const [k, v] of Object.entries(replacements)) out = out.replace(k, () => v)
  return out
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      try { results[i] = await fn(items[i], i) } catch (e) { results[i] = null }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
  return results
}

// ── Phase 1: research (breadth across country slices) ────────────────────────
phase('Research')
const research = await parallel(plan.researchAgents.map((ra) => () =>
  agent(ra.researchPrompt, {
    schema: plan.schemas.research, model: 'sonnet',
    label: `research:${plan.trend}:${ra.idx}`, phase: 'Research',
  })))
const candidates = research.filter(Boolean).flatMap((r) => r.candidates)
log(`researched ${candidates.length} candidate ${plan.trend} events across ${plan.researchAgents.length} agents`)
if (!candidates.length) return { mode: 'A-trend', trend: plan.trend, events: [] }

// ── Phase 2: curate (dedup, wrong-trend filter, one per country-year) ────────
phase('Curate')
const curatePrompt = plan.curatePrompt +
  '\n\n## Candidate events JSON (curate these)\n' + JSON.stringify(candidates, null, 2)
const curated = await agent(curatePrompt, {
  schema: plan.schemas.curate, model: 'sonnet', label: `curate:${plan.trend}`, phase: 'Curate',
})
if (!curated) return { mode: 'A-trend', trend: plan.trend, events: [] }
log(`curated ${curated.curated_events.length} kept, ${curated.dropped.length} dropped`)

// ── Phase 3: two blind verifiers per curated event ───────────────────────────
phase('Verify')
const events = await mapLimit(curated.curated_events, plan.caps.VERIFIER_CONCURRENCY_B, async (ev) => {
  const eventJson = JSON.stringify(
    { year: ev.year, title: ev.title, description: ev.description, category: ev.category }, null, 2)
  const vPrompt = fill(plan.verifyPromptTemplate, {
    __COUNTRY__: ev.country,
    __EVENT_JSON__: eventJson,
    __PRIOR_DOMAINS__: '(none — you are one of the first blind passes; still prefer the most authoritative source)',
    __WHY__: plan.verifyWhy,
  })
  const runVerifier = (n) => agent(vPrompt, { schema: plan.schemas.verify, model: 'sonnet',
    label: `verify${n}:${ev.country}:${ev.year}`, phase: 'Verify' })
  const nVerifiers = plan.caps.VERIFIER_CONCURRENCY_A ?? 2
  let passes = (await parallel(
    Array.from({ length: nVerifiers }, (_, i) => () => runVerifier(i + 1)))).filter(Boolean)
  // retry once per missing pass — a transient failure must not cost the event its
  // born-double-verified status (merge-a-trend refuses events with <2 passes)
  for (let attempt = 0; passes.length < 2 && attempt < 2; attempt++) {
    const retry = await runVerifier(`r${attempt + 1}`)
    if (retry) passes.push(retry)
  }
  return { event: ev, passes }
})

return {
  mode: 'A-trend',
  trend: plan.trend,
  rawCandidates: candidates.length,
  dropped: curated.dropped,
  dedupReport: curated.dedup_report,
  coverageNotes: research.filter(Boolean).map((r) => r.coverage_note),
  events: events.filter(Boolean),
}
