export const meta = {
  name: 'curation-wave1-recipe-agnostic',
  description: 'Wave 1 (top 200 events): locked v3 pipeline, recipe-agnostic what_happened_next curation. research -> conservative draft -> 2 web verifiers -> repair-if-REVISE -> reverify.',
  phases: [
    { title: 'Generate', detail: 'research (web) -> conservative draft' },
    { title: 'VerifyRepair', detail: 'verify -> repair-if-REVISE -> reverify' },
  ],
}

const EVENTS = __EVENTS_JSON__

const WS = 'You have access to the WebSearch tool (a DEFERRED tool -- first call ToolSearch with query "select:WebSearch" to load its schema, then call WebSearch). Use LIVE search; never answer from memory alone. SEARCH BUDGET: run AT MOST 3 web searches total, then STOP searching and decide with what you have. CRITICAL: you MUST finish by calling the StructuredOutput tool with your structured result -- never end your turn without it, even if information is thin or uncertain (in that case return found=false / FAIL as appropriate).'

const RESEARCH_SCHEMA = { type: 'object', required: ['found', 'facts', 'sources', 'confidence'], properties: { found: { type: 'boolean' }, facts: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } }, confidence: { type: 'string', enum: ['high', 'medium', 'low', 'none'] } } }
const DRAFT_SCHEMA = { type: 'object', required: ['ship', 'blurb', 'confidence', 'used_sources', 'research_facts'], properties: { ship: { type: 'boolean' }, blurb: { type: ['string', 'null'] }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, used_sources: { type: 'array', items: { type: 'string' } }, research_facts: { type: 'string' } } }
const VERIFY_SCHEMA = { type: 'object', required: ['verdict', 'refuted_claims', 'confirmed_claims', 'sources', 'reason'], properties: { verdict: { type: 'string', enum: ['PASS', 'REVISE', 'FAIL'] }, confirmed_claims: { type: 'string' }, refuted_claims: { type: 'string' }, sources: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } } }
const REPAIR_SCHEMA = { type: 'object', required: ['blurb', 'changes_made', 'used_sources'], properties: { blurb: { type: 'string' }, changes_made: { type: 'string' }, used_sources: { type: 'array', items: { type: 'string' } } } }

const LENS_A = 'LENS A: focus on the CORE EVENT + OUTCOME -- did the described event actually happen in/around that year, who did it, and the result/direction.'
const LENS_B = 'LENS B: focus on DATES, named ACTORS, ANACHRONISMS, and any unconfirmable secondary statistic -- is the year right, are the named people/parties correct for that time.'
const RULES = '\n\nVerdict rules -- judge the LOAD-BEARING claims (did the event happen, who, the outcome/direction, the rough timeframe); do NOT withhold PASS over debatable framings:\n- PASS if the core event + outcome are confirmed by a reputable source you retrieved AND nothing in the blurb is factually CONTRADICTED. A merely DEBATABLE secondary framing (sources reasonably differ, an approximate figure in a reasonable range, a slightly different cited date) is NOT grounds to withhold PASS. Omitting detail is never a defect.\n- REVISE only if a SPECIFIC secondary claim is clearly WRONG (directly contradicted) while the core stays right.\n- FAIL if a load-bearing claim is contradicted, the event did not occur as stated, or the core cannot be confirmed at all.\nList the source URLs you retrieved.'

function verifyOne(country, year, blurb, lens, lensName, bid) {
  return agent(WS + '\n\nYou are a SKEPTICAL historical fact-checker. A blurb claims the following about ' + country + ', ' + year + ':\n\n[BLURB] ' + blurb + ' [/BLURB]\n\nIndependently run LIVE web searches to confirm or REFUTE each factual claim. Do NOT trust the blurb. ' + lens + RULES,
    { label: 'verify:' + bid + ':' + lensName, phase: 'VerifyRepair', model: 'sonnet', schema: VERIFY_SCHEMA })
}

async function verifyPanel(country, year, blurb, bid) {
  const vs = await parallel([
    () => verifyOne(country, year, blurb, LENS_A, 'core', bid),
    () => verifyOne(country, year, blurb, LENS_B, 'dates', bid),
  ])
  const va = vs[0], vb = vs[1]
  const accept = (va && va.verdict) === 'PASS' && (vb && vb.verdict) === 'PASS'
  const anyFail = [(va && va.verdict), (vb && vb.verdict)].includes('FAIL')
  return { va, vb, accept, anyFail }
}

phase('Generate')

const results = await pipeline(
  EVENTS,
  (ev) => agent(WS + '\n\nYou are a historical researcher. Find the single most historically salient political/economic event in ' + ev.country + ' in or around ' + ev.year + ' and what it led to (the outcome). Context hint -- this year is used in a geopolitical risk model as a precedent for these event-types: ' + JSON.stringify(ev.recipes) + ' (use only as a hint for what is salient; report what ACTUALLY happened). Run live web searches against reputable sources. Return ONLY structured facts + the source URLs you retrieved -- no prose. If you cannot find a salient, sourced event for that country/year, set found=false, confidence="none" (do NOT invent).',
    { label: 'research:' + ev.id, phase: 'Generate', model: 'sonnet', schema: RESEARCH_SCHEMA }),
  (res, ev) => agent('You are a precise, academic copywriter. Write a single 1-2 sentence "what happened next" outcome blurb about ' + ev.country + ' in/around ' + ev.year + ', using ONLY the facts in this packet.\n\nCONSERVATIVE RULES: State ONLY core, well-established facts (what happened, who, the outcome/direction, rough timeframe). Do NOT include precise secondary statistics (GDP %, exact casualty counts, growth rates, financial figures) unless that number is the single central, universally-reported fact. Prefer a SHORTER, rock-solid blurb. ~25-45 words. If found=false OR confidence is "low"/"none": ship=false, blurb=null (ship null, never a guess).\n\nPACKET: found=' + (res && res.found) + '; confidence=' + (res && res.confidence) + '\nfacts: ' + ((res && res.facts) || '(none)') + '\nsources: ' + JSON.stringify((res && res.sources) || []) + '\n\nCarry research_facts = the packet facts verbatim. You MUST end by calling the StructuredOutput tool with your result.',
    { label: 'draft:' + ev.id, phase: 'Generate', model: 'sonnet', schema: DRAFT_SCHEMA }),
  async (draft, ev) => {
    const base = { iso2: ev.iso2, year: ev.year, country: ev.country }
    if (!draft || !draft.ship || !draft.blurb) return { ...base, status: 'null-shipped', blurb: null, confidence: (draft && draft.confidence) || 'none' }
    const r1 = await verifyPanel(ev.country, ev.year, draft.blurb, ev.id)
    if (r1.accept) return { ...base, status: 'accept-first', blurb: draft.blurb, sources: draft.used_sources, confidence: draft.confidence }
    if (r1.anyFail) return { ...base, status: 'reject-fail', blurb: draft.blurb }
    const feedback = 'A: ' + ((r1.va && r1.va.refuted_claims) || '') + ' | B: ' + ((r1.vb && r1.vb.refuted_claims) || '')
    const rep = await agent('Repair a "what happened next" blurb about ' + ev.country + ', ' + ev.year + '. Two fact-checkers flagged specific secondary claims. REWRITE to KEEP the confirmed core (event + outcome + rough timeframe) and DROP or correct every flagged claim. Use ONLY the research facts below; add nothing new. Shorter and rock-solid. ~25-40 words.\n\nCURRENT: ' + draft.blurb + '\nFEEDBACK: ' + feedback + '\nRESEARCH FACTS (only source): ' + draft.research_facts + '\n\nYou MUST end by calling the StructuredOutput tool with your repaired result.',
      { label: 'repair:' + ev.id, phase: 'VerifyRepair', model: 'sonnet', schema: REPAIR_SCHEMA })
    if (!rep || !rep.blurb) return { ...base, status: 'repair-failed' }  // transient repair-agent failure -> not ledgered/parked -> stays in remaining -> retried next wave
    const r2 = await verifyPanel(ev.country, ev.year, rep.blurb, ev.id + 'R')
    return { ...base, status: r2.accept ? 'accept-repair' : 'park', blurb: rep.blurb, original_blurb: draft.blurb, sources: rep.used_sources, confidence: draft.confidence }
  },
)

return { results: results.filter(Boolean) }
