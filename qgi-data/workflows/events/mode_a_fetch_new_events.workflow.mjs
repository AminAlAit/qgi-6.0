export const meta = {
  name: 'qgi-mode-a-fetch-new-events',
  description: 'Fetch new curated events for one country: research -> curate -> 2x blind verify, per taxonomy shard',
  whenToUse: 'Founder trigger "run an event batch" / "fetch new events for {country}". args MUST be the plan JSON from: node qgi-data/workflows/events/_lib.mjs plan-a [--country slug]',
  phases: [
    { title: 'Research', detail: 'one web-research agent per pending taxonomy shard (max 4 shard chains in flight)' },
    { title: 'Curate', detail: 'no-tools dedup + anti-confabulation filter per shard' },
    { title: 'Verify', detail: 'two independent blind verifiers per curated event' },
  ],
}

// This script is agent-orchestration ONLY. All file I/O, dedup against ledgers,
// consensus computation, and persistence happen afterwards in deterministic code:
//   node qgi-data/workflows/events/_lib.mjs merge-a --plan <plan> --results <this return value>
// The verifier fleet is fixed at claude-sonnet-5 (founder-ratified) via model:'sonnet'.

const plan = args
if (!plan || plan.mode !== 'A' || !Array.isArray(plan.shardsPending)) {
  throw new Error('args must be the plan JSON produced by: node _lib.mjs plan-a')
}

// shared candidate budget across concurrent shard chains (single-threaded JS —
// increments are race-free). merge-a re-enforces this cap deterministically.
let budgetLeft = plan.caps.MAX_NEW_CANDIDATES
let cappedOut = 0

// String.replace with a replacer FUNCTION: agent-generated text can contain
// $-sequences ($$, $&, $') that a plain string replacement would expand,
// corrupting the prompt (mirrors _lib.mjs fillTemplate — self-contained copy).
const fill = (template, replacements) => {
  let out = template
  for (const [placeholder, value] of Object.entries(replacements)) {
    out = out.replace(placeholder, () => value)
  }
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

async function runShard(shard) {
  const research = await agent(shard.researchPrompt, {
    schema: plan.schemas.research, model: 'sonnet',
    label: `research:${shard.id}`, phase: 'Research',
  })
  if (!research) return null
  log(`shard ${shard.id}: ${research.candidates.length} candidates researched`)

  const curatePrompt = shard.curatePrompt +
    '\n\n## Candidate events JSON (curate these)\n' +
    JSON.stringify(research.candidates, null, 2)
  const curated = await agent(curatePrompt, {
    schema: plan.schemas.curate, model: 'sonnet',
    label: `curate:${shard.id}`, phase: 'Curate',
  })
  if (!curated) return null
  log(`shard ${shard.id}: ${curated.curated_events.length} kept, ${curated.dropped.length} dropped`)

  const events = []
  let shardCapped = 0
  let incompletePasses = 0
  for (const ev of curated.curated_events) {
    if (budgetLeft <= 0) { cappedOut++; shardCapped++; continue }
    budgetLeft--

    const eventJson = JSON.stringify(
      { year: ev.year, title: ev.title, description: ev.description, category: ev.category },
      null, 2)
    const vPrompt = fill(plan.verifyPromptTemplate, {
      __EVENT_JSON__: eventJson,
      __PRIOR_DOMAINS__: '(none — you are one of the first blind passes; ' +
        'still prefer the most authoritative source you can find)',
      __WHY__: plan.verifyWhy,
    })

    // N blind verifiers in parallel; none sees the others (or the researcher's source)
    const runVerifier = (n) => agent(vPrompt, { schema: plan.schemas.verify, model: 'sonnet',
      label: `verify${n}:${shard.id}:${ev.year}`, phase: 'Verify' })
    const nVerifiers = plan.caps.VERIFIER_CONCURRENCY_A ?? 2
    let passes = (await parallel(
      Array.from({ length: nVerifiers }, (_, i) => () => runVerifier(i + 1))
    )).filter(Boolean)
    // retry once per missing pass — a transient agent error must not cost the event
    // its born-double-verified status (merge-a refuses events with <2 passes)
    for (let attempt = 0; passes.length < 2 && attempt < 2; attempt++) {
      const retry = await runVerifier(`r${attempt + 1}`)
      if (retry) passes.push(retry)
    }
    if (passes.length < 2) {
      incompletePasses++
      log(`shard ${shard.id}: verifier passes failed for "${ev.year} ${ev.title}" — event left for re-run`)
    }
    events.push({ event: ev, passes })
  }

  return {
    shardId: shard.id,
    rawCandidates: research.candidates.length,
    coverageNote: research.coverage_note,
    dropped: curated.dropped,
    dedupReport: curated.dedup_report,
    capped: shardCapped,
    incompletePasses,
    events,
  }
}

const shardResults = await mapLimit(plan.shardsPending, plan.caps.SHARD_CONCURRENCY, runShard)
if (cappedOut > 0) log(`MAX_NEW_CANDIDATES cap hit: ${cappedOut} curated candidates not verified this run — merge-a leaves their shards pending, so the next 'fetch new events for ${plan.country}' run re-covers them with a fresh budget`)

return {
  mode: 'A',
  country: plan.country,
  cappedOut,
  shardResults: shardResults.filter(Boolean),
}
