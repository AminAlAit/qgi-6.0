/**
 * QGI event-pipeline batch operator — deterministic library + CLI.
 *
 * Everything here is pure code (no model calls): planning, dedup, consensus
 * assembly, ledger I/O, file persistence, TRACKING regeneration. The Ultracode
 * Workflow scripts (mode_a_*.workflow.mjs / mode_b_*.workflow.mjs) cannot touch
 * the filesystem, so the contract is:
 *
 *   plan   :  node _lib.mjs plan-a --country fiji --out plan.json
 *             node _lib.mjs plan-b --batch 200 --out plan.json
 *             → the plan JSON is passed to the Workflow tool as `args`
 *   run    :  Workflow({scriptPath: mode_*.workflow.mjs, args: plan})
 *             → returns a results payload (agents only; no fs access)
 *   persist:  node _lib.mjs merge-a --plan plan.json --results results.json
 *             node _lib.mjs consolidate-b --plan plan.json --results results.json
 *             → deterministic write-back + ledger update + summary JSON on stdout
 *
 * Join contract (LOAD-BEARING): downstream joins curated↔verification on
 * (country_file_stem, year, normTitle(title)). year/title are join keys and are
 * NEVER mutated here; verifier echoes are guarded before any write.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  CAPS, CATEGORY_SUBSTITUTIONS, CONSENSUS_POLICY, SHARDS,
  VERDICTS, YEAR_RANGE, normTitle, recomputeConsensus,
  RESEARCH_OUTPUT_SCHEMA, CURATE_OUTPUT_SCHEMA, VERIFY_OUTPUT_SCHEMA
} from "./schemas.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EVENTS_DIR = path.resolve(HERE, "..", "..", "events");
export const CURATED_DIR = path.join(EVENTS_DIR, "curated");
export const VERIFICATION_DIR = path.join(EVENTS_DIR, "verification");
export const LEDGER_DIR = path.join(EVENTS_DIR, "_ledger");
export const TRACKING_PATH = path.join(EVENTS_DIR, "TRACKING.md");

// ─── file helpers ────────────────────────────────────────────────────────────

export function loadJson(p) {
  let text = fs.readFileSync(p, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // tolerate BOM on read; never write one
  return JSON.parse(text);
}

export function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8"); // UTF-8, no BOM, trailing newline
}

/** Mirror of build_verified_positives.py's file filter: country files only. */
export function isCountryFile(name) {
  return name.endsWith(".json") && !name.startsWith("_") && !name.includes("curation_report");
}

export function listCountrySlugs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(isCountryFile).map((f) => f.replace(/\.json$/, "")).sort();
}

// ─── identity / dedup ────────────────────────────────────────────────────────

/** Global dedup key: sha1("slug|year|normTitle") — same normalization as the
 * downstream join, so ledger identity == pipeline identity. */
export function dedupKey(slug, year, title) {
  return createHash("sha1").update(`${slug}|${year}|${normTitle(title)}`, "utf8").digest("hex");
}

// ─── source-domain independence ──────────────────────────────────────────────

const TWO_PART_TLDS = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "gov.au", "edu.au", "co.nz",
  "co.jp", "or.jp", "ne.jp", "co.in", "com.br", "co.za", "com.mx", "gob.mx",
  "com.ar", "com.tr", "co.kr", "com.cn", "com.sg", "org.au"
]);

/** Naive eTLD+1: "en.wikipedia.org" → "wikipedia.org". Returns null on bad URLs. */
export function registrableDomain(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
    const labels = host.split(".");
    if (labels.length <= 2) return host;
    const lastTwo = labels.slice(-2).join(".");
    return TWO_PART_TLDS.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
  } catch {
    return null;
  }
}

/** Cross-pass source diversity: "independent" | "same_domain" | "weak" | "n/a".
 * Computed by code (never by the agent) from verifications[].source.
 * Order-independent (same multiset of domains → same label): "independent" only
 * when every sourced pass cites a distinct registrable domain; "weak" when they
 * all share one domain; "same_domain" for any partial overlap. */
export function sourceIndependence(passes) {
  if (!Array.isArray(passes) || passes.length < 2) return "n/a";
  const withSource = passes
    .map((p) => (p.source ? registrableDomain(p.source) : null))
    .filter(Boolean);
  if (withSource.length < 2) return "n/a";        // fewer than two sourced passes — diversity unassessable
  const uniq = new Set(withSource).size;
  if (uniq === 1) return "weak";                   // every sourced pass leans on one domain (e.g. only Wikipedia)
  if (uniq === withSource.length) return "independent";
  return "same_domain";
}

// ─── v2 schema: migration + assembly ─────────────────────────────────────────

/** JS mirror of scripts/migrate_verification_to_v2.py::migrate_entry —
 * wraps a legacy flat verdict into verifications[0]; idempotent no-op on v2. */
export function migrateEntry(e) {
  if (!e || typeof e !== "object" || Array.isArray(e)) return e;
  if ("verifications" in e) return e;
  const v = String(e.verdict ?? "").trim().toUpperCase();
  if (!VERDICTS.includes(v)) return e; // malformed → leave for manual review
  const src = typeof e.source === "string" && e.source.trim() ? e.source.trim() : null;
  const p1 = {
    pass_n: 1, verdict: v, reason: e.reason ?? null, source: src,
    verifier: { model: "claude-sonnet-pre-migration", date: null, method: "web_search" }
  };
  const out = {
    year: e.year, title: e.title, verdict: v, reason: e.reason ?? null,
    verify_count: 1, consensus_verdict: v, consensus_status: "single",
    needs_tiebreak: false, source_independence: "n/a", verifications: [p1]
  };
  if (src) out.source = src;
  return out;
}

/** Derive the back-compat top-level reason/source from the passes + consensus.
 * For every non-CONTESTED consensus, recomputeConsensus returns a verdict that is
 * present among the passes, so a confirming pass always exists — fail loudly if
 * that invariant ever breaks rather than attaching a mismatched reason/source. */
function deriveTopLevel(passes, cons) {
  if (cons.consensus_verdict === "CONTESTED") {
    const parts = passes.map((p) => `Pass ${p.pass_n} ${p.verdict}: ${p.reason ?? "(no reason)"}`);
    return { reason: `${parts.join("; ")}. Tiebreak required.`, source: null };
  }
  const anchor = [...passes].reverse().find((p) => p.verdict === cons.consensus_verdict);
  if (!anchor) throw new Error(`deriveTopLevel: no pass carries consensus ${cons.consensus_verdict}`);
  const sourced = [...passes].reverse().find(
    (p) => p.source && p.verdict === cons.consensus_verdict);
  return { reason: anchor.reason ?? null, source: sourced?.source ?? null };
}

/** Assemble a full v2 verification entry from join keys + verifications[]. */
export function buildVerificationEntry(year, title, passes, policy = CONSENSUS_POLICY) {
  const cons = recomputeConsensus(passes, policy);
  const { reason, source } = deriveTopLevel(passes, cons);
  const out = {
    year, title,
    verdict: cons.verdict, reason,
    verify_count: passes.length,
    consensus_verdict: cons.consensus_verdict,
    consensus_status: cons.consensus_status,
    needs_tiebreak: cons.needs_tiebreak,
    source_independence: sourceIndependence(passes),
    verifications: passes
  };
  if (cons.had_dissent) out.had_dissent = true; // founder spot-check queue marker
  if (source) out.source = source;
  return out;
}

/** A verifier pass object from an agent's VERIFY_OUTPUT_SCHEMA result. */
export function passFromAgentResult(res, passN, model = "claude-sonnet-5", date = todayISO()) {
  return {
    pass_n: passN,
    verdict: String(res.verdict).toUpperCase(),
    reason: res.reason,
    source: res.source && res.source.trim() ? res.source.trim() : null,
    verifier: { model, date, method: "web_search" },
    ...(res.corrected_year != null && res.corrected_year !== res.year
      ? { corrected_year: res.corrected_year } : {})
  };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Is this event done for Mode B purposes? (idempotency boolean) */
export function isDoubleVerified(entry) {
  return (entry.verify_count ?? (("verifications" in entry) ? entry.verifications.length : 1)) >= 2 &&
    entry.consensus_status !== "contested_open" && entry.needs_tiebreak !== true;
}

// ─── ledgers ─────────────────────────────────────────────────────────────────

const LEDGER_A_PATH = path.join(LEDGER_DIR, "mode_a_ledger.json");
const LEDGER_B_PATH = path.join(LEDGER_DIR, "mode_b_ledger.json");

export function loadLedgerA() {
  return fs.existsSync(LEDGER_A_PATH) ? loadJson(LEDGER_A_PATH) : { version: 1, cells: {}, event_keys: [] };
}
export function saveLedgerA(l) { saveJson(LEDGER_A_PATH, l); }
export function loadLedgerB() {
  return fs.existsSync(LEDGER_B_PATH) ? loadJson(LEDGER_B_PATH) : { version: 1, events: {}, runs: [] };
}
export function saveLedgerB(l) { saveJson(LEDGER_B_PATH, l); }

// ─── curated context / merge ─────────────────────────────────────────────────

/** (year, normTitle) → curated event, for one country. */
export function curatedIndex(slug) {
  const p = path.join(CURATED_DIR, `${slug}.json`);
  const idx = new Map();
  if (!fs.existsSync(p)) return idx;
  for (const e of loadJson(p)) {
    if (e && typeof e === "object" && e.year != null) {
      idx.set(`${Number(e.year)}|${normTitle(e.title)}`, e);
    }
  }
  return idx;
}

/** Curated events carry EXACTLY these four keys — never verified/verification_source. */
export function cleanCuratedEvent(ev) {
  return { year: ev.year, title: ev.title, description: ev.description, category: ev.category };
}

/** Fill __PLACEHOLDER__ slots with literal text. String.prototype.replace treats
 * $-sequences ($$, $&, $', $`) in a string replacement as substitution patterns —
 * agent/web-derived text (titles, descriptions, money figures like "US$$2bn")
 * would corrupt the prompt. A replacer FUNCTION inserts the value verbatim. */
export function fillTemplate(template, replacements) {
  let out = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    out = out.replace(placeholder, () => value);
  }
  return out;
}

// ─── prompts ─────────────────────────────────────────────────────────────────

export function categoriesBlock() {
  const lines = ["## CRITICAL: ONLY use these 71 canonical categories. Do NOT invent new ones."];
  for (const s of SHARDS) {
    lines.push(`\n${s.id} — ${s.label}:\n  ${s.categories.join(", ")}`);
  }
  lines.push("\nCategory = the PRIMARY causal driver of the event, not a side-effect.");
  lines.push("If a label you want isn't in the list, force-map it:");
  for (const [k, v] of Object.entries(CATEGORY_SUBSTITUTIONS)) lines.push(`  ${k} -> ${v}`);
  return lines.join("\n");
}

export function buildResearchPrompt({ country, shard, existingTitles, why }) {
  return `You are a QGI event-research agent (web research only: WebSearch/WebFetch).

## Mission context (the why)
QGI (qgintelligence.com) trains per-Trend "recipe" models on curated + verified real
historical events — country-year positives. ${why}
You are researching REAL, verifiable historical events for **${country}** in theme
**${shard.id} — ${shard.label}** (categories listed below). Every event you return will
be independently fact-checked twice; a fabricated or mis-dated event poisons training data.

## Anti-confabulation hard rules
- NEVER invent an event, a year, a casualty figure, or a source URL.
- Every candidate MUST cite a real, working source_url you actually found via web search.
- If you cannot confirm an event's year and country from a real source, DO NOT include it.
- year must be within ${YEAR_RANGE[0]}–${YEAR_RANGE[1]}. Titles ≤ 120 chars, plain ASCII
  punctuation (no smart quotes, no em-dashes), specific and factual.
- description: 2–4 factual sentences with verifiable specifics (dates, names, magnitudes).

${categoriesBlock()}

## Scope for THIS shard
Use ONLY categories from theme ${shard.id}: ${shard.categories.join(", ")}.

## Recency cap
At most ~35% of a country's events may fall in 2020–2030; strongly prefer pre-2020
events (the training window ends 2021).

## Already-curated events for ${country} — do NOT re-fetch these (or near-duplicates)
${existingTitles.length ? existingTitles.map((t) => `- ${t}`).join("\n") : "(none yet)"}

## Target
~20 strong candidates for this shard (fewer is fine if the country's history is thin —
never pad with weak or invented entries; state shortfalls in coverage_note).
Set categories_valid=true only after re-checking every category against the inline list.`;
}

export function buildCuratePrompt({ country, shard }) {
  return `You are a QGI event-curation agent (no tools — work only from the JSON below).

Curate the candidate events for **${country}**, theme **${shard.id} — ${shard.label}**.

Rules:
- Emit curated_events entries with EXACTLY {year, title, description, category} — no
  other keys (never 'verified' or 'verification_source').
- Drop: duplicates of the already-curated list below (duplicate_existing), duplicates
  within this batch (duplicate_within_batch) — treat two entries as duplicates when they
  describe the same underlying event even if worded differently or 1 year apart; non-events
  (vague trends, decades-long processes) (non_event); anything with a category outside the
  71-list (category_confab) unless it force-maps cleanly per the substitution guide (then
  fix the category and keep it); year outside ${YEAR_RANGE[0]}–${YEAR_RANGE[1]} (out_of_range);
  low-confidence candidates (low_confidence).
- Explain EVERY drop in dropped[] with its reason code.
- Keep titles/descriptions as given unless fixing encoding or trimming length — factual
  content must not be altered.

${categoriesBlock()}

## Already-curated events for ${country} (dedup against these)
__EXISTING_TITLES__

Set all_categories_valid=true only after re-checking every kept event's category.`;
}

/** Blind verifier prompt. Template placeholders: __COUNTRY__, __EVENT_JSON__,
 * __PRIOR_DOMAINS__, __WHY__ — filled by the workflow per event (the template rides
 * in the plan ONCE; embedding a full prompt per event made 200-event plans too big).
 * The event JSON is ONLY {year,title,description,category} — never prior verdicts. */
export function verifyPromptTemplate(country = "__COUNTRY__") {
  return `You are a blind, independent QGI event fact-checker (WebSearch/WebFetch).
You have NO knowledge of any earlier verification of this event, and you must not
assume one exists. Verify from scratch.

## Why this matters
__WHY__
A wrong TRUE ships label noise into model training; a wrong FALSE throws away a real
training positive. Be rigorous and cite what you actually found.

## The event (country file: ${country})
__EVENT_JSON__

## Your job
Web-search this event. Confirm: did this happen in this country, in this year, materially
as described?

Verdict vocabulary:
- TRUE      — the event happened in that country and year, materially as described.
- PARTIAL   — the event is real but a material detail is off (wrong magnitude, actor, or
              scope) while year+country hold.
- FALSE     — it did not happen as described, or the year is wrong (report the real year
              in corrected_year; top-level year must still echo the input VERBATIM).
- UNCERTAIN — you could not confirm or refute from acceptable sources.

Hard rules:
- Echo year and title back EXACTLY as given above — they are join keys. Never reword.
- Source-independence: the following registrable domains were used by earlier passes and
  are OFF-LIMITS as your corroborating source: __PRIOR_DOMAINS__
  If the ONLY corroboration you can find is on those domains, return UNCERTAIN with
  reason "no independent source found". Never return TRUE on off-limits-domain evidence alone.
- A TRUE or PARTIAL verdict REQUIRES a working source URL in 'source'. Use "" only for
  UNCERTAIN/FALSE-by-absence cases.
- List your actual search queries in 'searched'.
- NEVER fabricate a URL, a quote, or a date.`;
}

// ─── Mode B priority (§5.2) ──────────────────────────────────────────────────

export const P1_FRAGILE_CATEGORIES = [
  "religious_and_social_movement", "technology_breakthrough", "economic_growth_milestone",
  "economic_nationalization", "monetary_policy_change", "currency_crisis", "labor_action",
  "banking_and_financial_crisis", "agricultural_policy", "ethnic_and_communal_conflict"
];
export const P2_LOW_JOIN_COUNTRIES = ["ukraine", "venezuela", "iran", "bhutan", "ethiopia", "madagascar"];
export const P3_FLAGSHIP_CATEGORIES = [
  "elections_and_voting", "bilateral_treaty", "government_formation", "civil_war_and_insurgency",
  "constitutional_change", "political_repression", "democratic_transition", "mass_protest"
];

export function eventTier(slug, category) {
  if (category && P1_FRAGILE_CATEGORIES.includes(category)) return 1;
  if (P2_LOW_JOIN_COUNTRIES.includes(slug)) return 2;
  if (category && P3_FLAGSHIP_CATEGORIES.includes(category)) return 3;
  return 4;
}

// NOTE (blindness contract): these strings are injected into BLIND verifier prompts.
// They must never reveal a prior pass's verdict/reason/direction, imply the event is
// currently counted one way, or make one verdict sound more helpful than another.
export function tierWhy(tier, category) {
  switch (tier) {
    case 1: return `'${category}' feeds a Trend whose training set sits near its minimum-size threshold, so each verdict here carries outsized weight. An accurate verdict matters more than any particular one: a wrong TRUE injects noise into a small training set; a wrong FALSE discards scarce real signal. Both errors are equally costly.`;
    case 2: return "This country's event records have known title/encoding drift, so careful, from-scratch fact-checking of the exact year and event is especially valuable here. Accuracy in either direction is the goal.";
    case 3: return `'${category}' is a high-volume Trend; verdict accuracy at scale is the goal — a wrong TRUE and a wrong FALSE are equally costly.`;
    default: return "This event is part of a systematic accuracy sweep across the corpus. A wrong TRUE and a wrong FALSE are equally costly.";
  }
}

/** Verification slugs in §5.2 priority order (P2 low-join countries first as whole
 * files, then everything else alphabetically; event-level tiers do the fine ordering). */
export function listVerificationSlugsByPriority() {
  const all = listCountrySlugs(VERIFICATION_DIR);
  const p2 = P2_LOW_JOIN_COUNTRIES.filter((s) => all.includes(s));
  return [...p2, ...all.filter((s) => !p2.includes(s))];
}

// ─── plan-a ──────────────────────────────────────────────────────────────────

/** §5.1 lever-A ordering: the 43 no-verification countries, highest curated count first. */
export function nextModeACountry(ledger) {
  const curated = listCountrySlugs(CURATED_DIR);
  const verified = new Set(listCountrySlugs(VERIFICATION_DIR));
  const noVer = curated.filter((s) => !verified.has(s));
  const counts = Object.fromEntries(noVer.map((s) => {
    try { return [s, loadJson(path.join(CURATED_DIR, `${s}.json`)).length]; }
    catch { return [s, 0]; }
  }));
  const ordered = [...noVer].sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  for (const s of ordered) {
    const cell = ledger.cells[s];
    if (!cell || (cell.shards_done ?? []).length < SHARDS.length) return s;
  }
  return null;
}

export function planA({ country = null } = {}) {
  const ledger = loadLedgerA();
  const slug = country ?? nextModeACountry(ledger);
  if (!slug) throw new Error("plan-a: no country given and no unstarted country found in the lever-A queue");
  const curatedPath = path.join(CURATED_DIR, `${slug}.json`);
  const existing = fs.existsSync(curatedPath) ? loadJson(curatedPath) : [];
  const cell = ledger.cells[slug] ?? { shards_done: [], candidates_added: 0 };
  const shardsPending = SHARDS.filter((s) => !(cell.shards_done ?? []).includes(s.id));
  const existingByShard = (shard) => existing
    .filter((e) => shard.categories.includes(e.category))
    .map((e) => `${e.year} — ${e.title}`);
  // researchWhy motivates the research/curate agents; verifyWhy goes into BLIND
  // verifier prompts and must stay direction-neutral (no "help add positives" framing).
  const researchWhy = `${slug} currently contributes ZERO training positives (no verification file yet); ` +
    `every real, verifiable event found here expands its Trend coverage.`;
  const verifyWhy = `This event is a fresh candidate for ${slug}'s ground-truth event database. ` +
    `Your verdict — TRUE, FALSE, PARTIAL, or UNCERTAIN — is what makes it usable; ` +
    `a wrong TRUE ships label noise, a wrong FALSE discards real signal. Both errors are equally costly.`;
  return {
    mode: "A",
    country: slug,
    curatedCount: existing.length,
    policy: CONSENSUS_POLICY,
    caps: CAPS, // MAX_NEW_CANDIDATES is a PER-RUN cap (spec §4.1 "Cap / run") — re-runs get a fresh budget
    shardsPending: shardsPending.map((shard) => ({
      id: shard.id,
      label: shard.label,
      categories: shard.categories,
      researchPrompt: buildResearchPrompt({ country: slug, shard, existingTitles: existingByShard(shard), why: researchWhy }),
      curatePrompt: fillTemplate(buildCuratePrompt({ country: slug, shard }), {
        __EXISTING_TITLES__: existingByShard(shard).map((t) => `- ${t}`).join("\n") || "(none yet)"
      })
    })),
    verifyPromptTemplate: verifyPromptTemplate(slug),
    verifyWhy,
    schemas: { research: RESEARCH_OUTPUT_SCHEMA, curate: CURATE_OUTPUT_SCHEMA, verify: VERIFY_OUTPUT_SCHEMA }
  };
}

// ─── merge-a (deterministic persist for Mode A) ──────────────────────────────

export function mergeA(plan, results) {
  const slug = plan.country;
  if (results.country && results.country !== slug) {
    throw new Error(`merge-a: results are for '${results.country}' but plan is for '${slug}' — ` +
      `mismatched --plan/--results pair, refusing to merge`);
  }
  const ledger = loadLedgerA();
  const cell = ledger.cells[slug] ?? { shards_done: [], candidates_added: 0 };
  const globalKeys = new Set(ledger.event_keys);
  const curatedPath = path.join(CURATED_DIR, `${slug}.json`);
  const verificationPath = path.join(VERIFICATION_DIR, `${slug}.json`);
  const curated = fs.existsSync(curatedPath) ? loadJson(curatedPath) : [];
  const verification = fs.existsSync(verificationPath) ? loadJson(verificationPath) : [];

  const joinKey = (year, title) => `${Number(year)}|${normTitle(title)}`;
  const curatedByKey = new Map(curated
    .filter((e) => e && typeof e === "object" && e.year != null)
    .map((e) => [joinKey(e.year, e.title), e]));
  const verifiedKeys = new Set(verification
    .filter((e) => e && typeof e === "object" && e.year != null)
    .map((e) => joinKey(e.year, e.title)));
  const addedThisRun = new Set();

  const summary = {
    country: slug, shards_run: [], shards_done: [], shards_incomplete: [],
    added: 0, attached_to_existing: 0, dup_existing: 0, dup_within_batch: 0,
    dup_ledger: 0, echo_mismatch: 0, capped: 0, unverified_skipped: 0,
    verdicts: { TRUE: 0, FALSE: 0, PARTIAL: 0, UNCERTAIN: 0, CONTESTED: 0 },
    independence: {}, added_events: [], dropped_events: []
  };

  let budget = plan.caps.MAX_NEW_CANDIDATES; // per-run cap (spec §4.1); re-enforced here deterministically
  const newCurated = [], newVerification = [];
  const record = (entry, ev, attached) => {
    summary.verdicts[entry.consensus_verdict] = (summary.verdicts[entry.consensus_verdict] ?? 0) + 1;
    summary.independence[entry.source_independence] =
      (summary.independence[entry.source_independence] ?? 0) + 1;
    summary.added_events.push({ year: entry.year, title: entry.title, category: ev.category,
      consensus: entry.consensus_verdict, ...(attached ? { attached_to_existing: true } : {}) });
  };

  for (const shard of results.shardResults ?? []) {
    if (!shard) continue;
    summary.shards_run.push(shard.shardId);
    // a shard that capped out or lost events to failed verifier passes is NOT done:
    // leaving it pending lets a re-run re-research it (ledger/event_keys dedup makes
    // re-covering already-persisted events a no-op).
    let shardComplete = (shard.capped ?? 0) === 0;
    for (const item of shard.events ?? []) {
      const ev = item.event;
      // agents whose echo drifted from the event they were given are unusable — join-key safety
      const passesRaw = (item.passes ?? []).filter((p) =>
        p && Number(p.year) === Number(ev.year) && normTitle(p.title) === normTitle(ev.title));
      if ((item.passes ?? []).length !== passesRaw.length) summary.echo_mismatch++;
      if (passesRaw.length < 2) { // born double-verified or not at all — re-run re-covers it
        summary.unverified_skipped++;
        summary.dropped_events.push({ shard: shard.shardId, year: ev.year, title: ev.title,
          reason: "fewer than 2 valid verifier passes" });
        shardComplete = false;
        continue;
      }
      const jk = joinKey(ev.year, ev.title);
      if (addedThisRun.has(jk)) { summary.dup_within_batch++; continue; }

      const existing = curatedByKey.get(jk);
      if (existing) {
        if (verifiedKeys.has(jk)) { summary.dup_existing++; continue; }
        // the event is already curated but has NO verdict (the norm for the 43
        // no-verification countries): the two completed blind passes are exactly
        // the missing verification entry — attach them to the EXISTING event's
        // exact join keys instead of discarding paid verifier work.
        const passes = passesRaw.map((p, i) => passFromAgentResult(p, i + 1));
        const entry = buildVerificationEntry(existing.year, existing.title, passes, plan.policy);
        newVerification.push(entry);
        verifiedKeys.add(jk);
        globalKeys.add(dedupKey(slug, existing.year, existing.title));
        summary.attached_to_existing++;
        record(entry, existing, true);
        continue;
      }

      const key = dedupKey(slug, ev.year, ev.title);
      if (globalKeys.has(key)) { summary.dup_ledger++; continue; }
      if (budget <= 0) {
        summary.capped++;
        summary.dropped_events.push({ shard: shard.shardId, year: ev.year, title: ev.title,
          reason: "MAX_NEW_CANDIDATES cap" });
        shardComplete = false;
        continue;
      }

      const passes = passesRaw.map((p, i) => passFromAgentResult(p, i + 1));
      const entry = buildVerificationEntry(ev.year, ev.title, passes, plan.policy);
      newCurated.push(cleanCuratedEvent(ev));
      newVerification.push(entry);
      addedThisRun.add(jk);
      verifiedKeys.add(jk);
      globalKeys.add(key);
      budget--;
      summary.added++;
      record(entry, ev, false);
    }
    (shardComplete ? summary.shards_done : summary.shards_incomplete).push(shard.shardId);
  }

  // persist: append new events at the end (year-sorted within the appended block)
  newCurated.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
  newVerification.sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
  if (newCurated.length) saveJson(curatedPath, [...curated, ...newCurated]);
  if (newVerification.length) saveJson(verificationPath, [...verification, ...newVerification]);

  cell.shards_done = [...new Set([...(cell.shards_done ?? []), ...summary.shards_done])].sort();
  cell.candidates_added = (cell.candidates_added ?? 0) + summary.added;
  cell.curated_sha256 = fileSha256(curatedPath);
  cell.verification_sha256 = fileSha256(verificationPath);
  cell.last_run = new Date().toISOString();
  ledger.cells[slug] = cell;
  ledger.event_keys = [...globalKeys].sort();
  saveLedgerA(ledger);
  regenTracking(); // recompute counters from truth — never bump the stale base blindly
  return summary;
}

function fileSha256(p) {
  return fs.existsSync(p) ? createHash("sha256").update(fs.readFileSync(p)).digest("hex") : null;
}

// ─── plan-b ──────────────────────────────────────────────────────────────────

/** Ledger-side "this event is settled" predicate (mirror of isDoubleVerified for
 * mode_b_ledger records). */
export function ledgerSettled(led) {
  return Boolean(led && led.verify_count >= 2 && !led.needs_tiebreak);
}

export function planB({ country = null, batch = CAPS.EVENT_BATCH_SIZE, includeUnverified = false } = {}) {
  const ledgerB = loadLedgerB();
  const slugs = country ? [country] : listVerificationSlugsByPriority();
  const selected = [], skippedOrphans = [];

  for (const slug of slugs) {
    const vPath = path.join(VERIFICATION_DIR, `${slug}.json`);
    const cIdx = curatedIndex(slug);
    const entries = fs.existsSync(vPath) ? loadJson(vPath).map(migrateEntry) : [];
    const verifiedKeys = new Set();

    for (const entry of entries) {
      if (!entry || typeof entry !== "object" || entry.year == null) continue;
      const jk = `${Number(entry.year)}|${normTitle(entry.title)}`;
      verifiedKeys.add(jk);
      if (!("verifications" in entry)) continue; // malformed legacy verdict — manual review, not batchable
      if (isDoubleVerified(entry)) continue;
      if (ledgerSettled(ledgerB.events[dedupKey(slug, entry.year, entry.title)])) continue;
      const cur = cIdx.get(jk);
      if (!cur) { skippedOrphans.push({ slug, year: entry.year, title: entry.title }); continue; }
      selected.push({ slug, entry, cur, tier: eventTier(slug, cur.category), passesNeeded: 1 });
    }

    // zero-verdict curated events (the 43-country lever, or a named country's gaps):
    // these need TWO fresh blind passes to be born double-verified.
    if (includeUnverified || country) {
      for (const [jk, cur] of cIdx) {
        if (verifiedKeys.has(jk)) continue;
        if (ledgerSettled(ledgerB.events[dedupKey(slug, cur.year, cur.title)])) continue;
        selected.push({ slug, entry: null, cur, tier: eventTier(slug, cur.category), passesNeeded: 2 });
      }
    }
  }

  selected.sort((a, b) => a.tier - b.tier || a.slug.localeCompare(b.slug) ||
    a.cur.year - b.cur.year || a.cur.title.localeCompare(b.cur.title));
  // materialize per-event fields ONLY for the sliced batch — right after migration
  // ~11.7k events are selectable and building payloads for all of them is pure waste
  const batchEvents = selected.slice(0, batch).map(makePlanBEvent);
  return {
    mode: "B",
    policy: CONSENSUS_POLICY,
    caps: CAPS,
    // the workflow composes each blind prompt from this ONE template + the
    // per-event fields below (fillTemplate semantics: replacer-fn, verbatim)
    verifyPromptTemplate: verifyPromptTemplate(),
    batch: batchEvents,
    totalSelectable: selected.length,
    skippedOrphans,
    schemas: { verify: VERIFY_OUTPUT_SCHEMA }
  };
}

function makePlanBEvent({ slug, entry, cur, tier, passesNeeded }) {
  const priorPasses = entry?.verifications ?? [];
  const priorDomains = [...new Set(priorPasses.map((p) => p.source && registrableDomain(p.source))
    .filter(Boolean))];
  return {
    key: dedupKey(slug, cur.year, cur.title),
    slug, year: cur.year, title: cur.title, category: cur.category, tier,
    passesNeeded, // the workflow spawns this many blind passes of the same prompt
    eventJson: JSON.stringify(
      { year: cur.year, title: cur.title, description: cur.description, category: cur.category },
      null, 2),
    priorDomains: priorDomains.length ? priorDomains.join(", ") : "(none)",
    why: tierWhy(tier, cur.category)
  };
}

// ─── consolidate-b (deterministic persist for Mode B) ────────────────────────

export function consolidateB(plan, results) {
  const byKey = new Map();
  for (const r of results.results ?? []) {
    if (!r || !r.pass) continue;
    if (!byKey.has(r.key)) byKey.set(r.key, []);
    byKey.get(r.key).push(r);
  }
  const planByKey = new Map(plan.batch.map((e) => [e.key, e]));
  const ledgerB = loadLedgerB();
  const summary = {
    events_updated: 0, echo_mismatch: 0, reentrancy_skipped: 0, replay_skipped: 0,
    single_pass_new: 0, legacy_entries_migrated: 0,
    consensus: {}, flips_true_to_nontrue: [], flips_nontrue_to_true: [],
    independence: {}, needs_tiebreak: [], countries_touched: new Set()
  };

  const bySlug = new Map();
  for (const [key, passes] of byKey) {
    const pe = planByKey.get(key);
    if (!pe) continue;
    if (!bySlug.has(pe.slug)) bySlug.set(pe.slug, []);
    bySlug.get(pe.slug).push({ pe, agentResults: passes });
  }

  for (const [slug, jobs] of bySlug) {
    const vPath = path.join(VERIFICATION_DIR, `${slug}.json`);
    const raw = fs.existsSync(vPath) ? loadJson(vPath) : [];
    const entries = raw.map(migrateEntry);
    // writing a touched file migrates ALL its legacy entries to v2 as a side effect
    // (spec §4.3 phase 1: migrate in memory as you go; Mode B only runs after the
    // B1/B2 founder gates) — count it so the PR review sees the migration explicitly
    const migratedInFile = raw.reduce((n, e, i) => n + (entries[i] !== e ? 1 : 0), 0);
    const idx = new Map(entries.map((e, i) => [`${Number(e.year)}|${normTitle(e.title)}`, i]));
    let touched = false;

    for (const { pe, agentResults } of jobs) {
      // join-safety guard: verifier must echo year+title verbatim (normTitle-insensitive
      // on title to tolerate whitespace echoes, exact on year)
      const valid = agentResults.filter((r) =>
        Number(r.pass.year) === Number(pe.year) && normTitle(r.pass.title) === normTitle(pe.title));
      summary.echo_mismatch += agentResults.length - valid.length;
      if (!valid.length) continue;

      const jk = `${Number(pe.year)}|${normTitle(pe.title)}`;
      const i = idx.get(jk);
      let entry = i != null ? entries[i] : null;

      if (entry && isDoubleVerified(entry)) { summary.reentrancy_skipped++; continue; } // overlapping-run guard
      const before = entry ? String(entry.verdict).toUpperCase() : null;
      const priorPasses = entry?.verifications ?? [];
      // replay guard: an identical (verdict,reason,source) pass is a re-run of the
      // same results file, not a genuinely new pass — drop it so replays are no-ops
      const sig = (p) => `${p.verdict}|${p.reason ?? ""}|${p.source ?? ""}`;
      const seenSigs = new Set(priorPasses.map(sig));
      const newPasses = [];
      for (const r of valid) {
        const p = passFromAgentResult(r.pass, priorPasses.length + newPasses.length + 1);
        if (seenSigs.has(sig(p))) { summary.replay_skipped++; continue; }
        seenSigs.add(sig(p));
        newPasses.push(p);
      }
      if (!newPasses.length) continue;
      const allPasses = [...priorPasses, ...newPasses];
      const rebuilt = buildVerificationEntry(pe.year, pe.title, allPasses, plan.policy);
      // preserve the entry's exact original title/year strings (join keys) — pe carries
      // the curated values, entry may carry the verification-side variant; keep entry's.
      if (entry) { rebuilt.year = entry.year; rebuilt.title = entry.title; }

      if (i != null) entries[i] = rebuilt;
      else { entries.push(rebuilt); idx.set(jk, entries.length - 1); summary.single_pass_new++; }
      touched = true;
      summary.events_updated++;
      summary.consensus[rebuilt.consensus_status] = (summary.consensus[rebuilt.consensus_status] ?? 0) + 1;
      summary.independence[rebuilt.source_independence] =
        (summary.independence[rebuilt.source_independence] ?? 0) + 1;
      const after = rebuilt.consensus_verdict;
      if (before === "TRUE" && after !== "TRUE") {
        summary.flips_true_to_nontrue.push({ slug, year: pe.year, title: pe.title, after });
      } else if (before && before !== "TRUE" && after === "TRUE") {
        summary.flips_nontrue_to_true.push({ slug, year: pe.year, title: pe.title, before });
      }
      if (rebuilt.needs_tiebreak) summary.needs_tiebreak.push({ slug, year: pe.year, title: pe.title });
      ledgerB.events[pe.key] = {
        verify_count: rebuilt.verify_count, consensus: rebuilt.consensus_verdict,
        needs_tiebreak: rebuilt.needs_tiebreak, last_pass_ts: new Date().toISOString()
      };
      summary.countries_touched.add(slug);
    }

    if (touched) {
      saveJson(vPath, entries);
      summary.legacy_entries_migrated += migratedInFile;
    }
  }

  ledgerB.runs.push({
    ts: new Date().toISOString(), batch: plan.batch.length,
    countries_touched: [...summary.countries_touched].sort()
  });
  saveLedgerB(ledgerB);
  regenTracking();
  summary.countries_touched = [...summary.countries_touched].sort();
  return summary;
}

// ─── TRACKING.md regeneration ────────────────────────────────────────────────

/** Recompute the per-country Verified counter from the actual verification files.
 * Semantics (stated per the founder's §9.1 note): Verified = the MODAL per-event
 * verify_count across the country's verification entries (0 when no file). Modal,
 * not min: with a ~97.7% join rate a min would pin nearly every country to 0 and
 * carry no signal; the mode says what's true of the bulk of the country's labels. */
export function computeVerifiedCounters() {
  const out = {};
  for (const slug of listCountrySlugs(CURATED_DIR)) out[slug] = 0;
  for (const slug of listCountrySlugs(VERIFICATION_DIR)) {
    try {
      const entries = loadJson(path.join(VERIFICATION_DIR, `${slug}.json`)).map(migrateEntry);
      const counts = entries
        .filter((e) => e && typeof e === "object" && "verifications" in e)
        .map((e) => e.verify_count ?? e.verifications.length);
      if (!counts.length) { out[slug] = 0; continue; }
      const freq = new Map();
      for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
      out[slug] = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    } catch { out[slug] = 0; }
  }
  return out;
}

export function regenTracking(counters = null) {
  if (!fs.existsSync(TRACKING_PATH)) return false;
  counters = counters ?? computeVerifiedCounters();
  const today = todayISO();
  const text = fs.readFileSync(TRACKING_PATH, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n"; // the file is CRLF today; preserve whatever it uses
  const lines = text.split(/\r?\n/);
  // Rewrite ONLY the live "## Tracking table" section. TRACKING.md also contains
  // frozen historical per-session tables further down (### headings) with the same
  // row shape — those are append-only records and must never be retro-stamped.
  const start = lines.findIndex((l) => l.trim().startsWith("## Tracking table"));
  if (start < 0) return false;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("#")) { end = i; break; } // any heading (## or ###) ends the live table
  }
  const ROW_RE = /^\|\s*([a-z_]+)\s*\|(\s*[^|]*\|)(\s*[^|]*\|)\s*([^|]*)\|(\s*[^|]*\|)(.*)$/;
  const seenSlugs = new Set();
  let lastRow = -1;
  const out = lines.map((line, i) => {
    if (i <= start || i >= end) return line;
    const m = line.match(ROW_RE);
    if (!m) return line;
    lastRow = i;
    const slug = m[1];
    seenSlugs.add(slug);
    if (!(slug in counters)) return line;
    const oldVerified = m[4].trim();
    const newVerified = String(counters[slug]);
    if (oldVerified === newVerified) return line;
    return `| ${slug} |${m[2]}${m[3]} ${newVerified} | ${today} |${m[6]}`;
  });
  if (lastRow < 0) return false;
  // countries with data on disk but no row in the live table (they were only ever
  // logged in the historical session sections) get appended so the live table is
  // the complete current dashboard; Generated/Curated are unknown here — see logs.
  const missing = Object.keys(counters).filter((s) => !seenSlugs.has(s)).sort();
  const newRows = missing.map((s) =>
    `| ${s} | - | - | ${counters[s]} | ${today} | row added by regen-tracking (Generated/Curated: see session logs below) |`);
  out.splice(lastRow + 1, 0, ...newRows);
  fs.writeFileSync(TRACKING_PATH, out.join(eol), "utf8");
  return true;
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function cliArg(args, name, fallback = null) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}

/** B1 guard: schemas.mjs CONSENSUS_POLICY must equal the founder-ratified policy in
 * events/_ledger/consensus_policy.json — the validator enforces entries against the
 * file, the workflows compute against the constant; they must never diverge. */
function assertPolicySync() {
  const p = path.join(LEDGER_DIR, "consensus_policy.json");
  if (!fs.existsSync(p)) return; // pre-ratification checkout — nothing to assert
  const active = loadJson(p).active_policy;
  if (active !== CONSENSUS_POLICY) {
    throw new Error(`consensus-policy drift: schemas.mjs CONSENSUS_POLICY=` +
      `${CONSENSUS_POLICY} but events/_ledger/consensus_policy.json says ${active}. ` +
      `A policy flip must update both AND re-derive all verification entries in one commit.`);
  }
}

function main() {
  assertPolicySync();
  const [cmd, ...rest] = process.argv.slice(2);
  const out = cliArg(rest, "out");
  const emit = (obj) => {
    const text = JSON.stringify(obj, null, 2);
    if (out) { fs.writeFileSync(out, text + "\n", "utf8"); console.log(`wrote ${out}`); }
    else console.log(text);
  };
  switch (cmd) {
    case "plan-a":
      emit(planA({ country: cliArg(rest, "country") }));
      break;
    case "merge-a":
      emit(mergeA(loadJson(cliArg(rest, "plan")), loadJson(cliArg(rest, "results"))));
      break;
    case "plan-b":
      emit(planB({
        country: cliArg(rest, "country"),
        batch: Number(cliArg(rest, "batch", CAPS.EVENT_BATCH_SIZE)),
        includeUnverified: rest.includes("--include-unverified")
      }));
      break;
    case "consolidate-b":
      emit(consolidateB(loadJson(cliArg(rest, "plan")), loadJson(cliArg(rest, "results"))));
      break;
    case "regen-tracking": {
      const counters = computeVerifiedCounters();
      emit({ updated: regenTracking(counters), counters });
      break;
    }
    case "next-a":
      emit({ next: nextModeACountry(loadLedgerA()) });
      break;
    default:
      console.error("usage: node _lib.mjs <plan-a|merge-a|plan-b|consolidate-b|regen-tracking|next-a> [--country s] [--batch n] [--include-unverified] [--plan f] [--results f] [--out f]");
      process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
