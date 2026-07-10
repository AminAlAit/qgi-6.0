# Event-batch operator notes — lessons across batches

Consulted at the start of every Mode A / Mode B batch (Select step). One dated, terse
entry per lesson: what happened AND why it matters for the next batch. Update an entry
in place when a later batch supersedes it — don't duplicate. The two sibling ledgers
(`mode_a_ledger.json`, `mode_b_ledger.json`) track what's *done*; this file tracks
what's been *learned*.

---

- **2026-07-02** — Taxonomy carries a duplicate layer-3 entry: `sanctions_and_arms_embargo`
  appears under both D (Economic Stress) and F (Diplomacy & Geopolitics) in
  `taxonomy_hierarchy.json` (72 entries, 71 unique codes). Sharding assigns it to D only.
  Validator is unaffected (set-based). Taxonomy hygiene follow-up filed in session report.
- **2026-07-02** — Taxonomy layer-1 `definition` strings contain U+FFFD replacement chars
  (mojibake). Codes and labels are clean; don't quote definitions into agent prompts.
- **2026-07-02** — `events/batches/` (research seeds) does not exist in the repo. Research
  agents start from web search alone; don't reference seed files in prompts.
- **2026-07-02** — 11 orphan verification verdicts exist whose curated twin is gone
  (iran 5, venezuela 4, south_sudan 1, ukraine 1) — likely title rewording on the curated
  side after verification. plan-b skips them (no curated context to verify against);
  validate_verification.py warns on them (--strict-join to fail). They contribute nothing
  downstream. Candidates for cleanup when those countries' Mode-B batches run.
- **2026-07-02** — ukraine (0.543) and venezuela (0.656) have low curated↔verification
  join rates from title/Unicode drift. When Mode B walks them, expect many "no verdict
  found" events; corrected titles must NEVER be applied to join keys — flag them in the
  PR instead (corrected_year field exists for year drift; title drift goes in the report).
- **2026-07-02** — TRACKING.md's Verified column was stale (2026-04-07 basis, ~56
  countries marked vs 154 verification files on disk). `node _lib.mjs regen-tracking`
  recomputes it from files; counters are now regenerated (never bumped blindly).
  Semantics: Verified = MODAL per-event verify_count for the country (stated in §9.1
  decision; min would pin ~every country to 0 given the 97.7% join rate).
- **2026-07-02** — S3 (`events-source/curated/`) holds 198 curated files vs 197 in repo —
  one extra object in S3 to identify and prune at the next founder-run sync.
- **2026-07-02** — Operator-spec drift corrected: spec said "6 category shards"; the live
  taxonomy has 8 layer-1 themes (A–H). SHARDS follows the live taxonomy: 8.
- **2026-07-02** — Claude session limits can kill half a workflow fleet mid-run (agents die
  with "session limit" errors; the workflow returns partial results). Always read the
  failures block of a workflow result before trusting its coverage, and re-run lost
  lenses/batch slices after the limit resets rather than assuming they ran.
- **2026-07-02** — **B1 + B2 RATIFIED by founder (in-session).** B1: `CONSENSUS_POLICY =
  conservative_downgrade` — recorded in `consensus_policy.json` (this directory), asserted
  by the `_lib.mjs` CLI and enforced by `validate_verification.py`. B2: the v2
  double-verify schema is canonical; `migrate_verification_to_v2.py --apply` run on all
  154 verification files. A future policy flip must update the policy file + schemas.mjs
  + re-derive all entries from `verifications[]` in ONE commit.
- **2026-07-02** — Blindness rule for why-context: anything injected into a verifier prompt
  (tierWhy, verifyWhy) must never imply the event's current verdict ("re-verify", "a
  TRUE→FALSE flip would de-list", "help add positives") — adversarial review confirmed the
  first drafts anchored verifiers toward TRUE. Keep both error directions explicitly
  equal-cost in every verifier-facing string.
- **2026-07-02** — **Sync cadence (founder rule):** run the S3 sync only after every FIVE
  merged batches, not per batch. Track batch count via mode_b_ledger.json `runs[]` + Mode A
  cells; each batch report states "N of 5 since last sync". S3 sync = Claude-run now via the
  `QGIClaudeData` SSO role (temp STS triplet; boto3 — aws CLI absent on this box).
- **2026-07-02** — Workflow plans must not embed a full prompt per event (200-event plan blew
  past Workflow args size limits). Pattern in use: verify template rides ONCE in the plan
  (`plan.verifyPromptTemplate`), the Mode B workflow composes each per-event prompt via a
  replacer-fn fill. Also: a script fed to Workflow-by-scriptPath must be LF-only — a stray
  CRLF `\r` trips the harness "control characters" check on the approval dialog. Generate
  batch workflow scripts by embedding the plan JSON into the committed workflow body, then
  `.replace(/\r\n/g,'\n')`.
- **2026-07-02** — **Session-limit recovery (BATCH 1 lived it):** a 5h usage-limit hit mid-run
  killed 150/200 verifiers; consolidate-b had not run so files were UNTOUCHED. Recovery:
  harvest completed WRAPPED results from the task `.output` file's `result.results`
  (`{key,slug,year,title,pass}`) — NOT journal.jsonl (that holds raw agent output without the
  wrapper); build a remainder plan of events whose `key` isn't covered; run it as a FRESH
  workflow (do NOT `resumeFromRunId` — errored agents can cache as null); combine
  harvested+remainder → full results → one consolidate-b. Idempotent by design: un-run events
  stay at verify_count 1 and re-select, so nothing is ever lost to a limit.
- **2026-07-03** — **BATCHING REDESIGN (founder-directed), packaged as `/qgi-enrich-events`.**
  (1) **69 active Trends, not 71:** taxonomy stays 71 for curation/validation, but Mode A
  selects only from the 69 active Trends (`natural_disaster` + `epidemic_and_pandemic` are
  deactivated per the charter's endogenous-only rule). (2) **Mode A is now TREND-FIRST:** pick
  ONE Trend (highest unlock value — thin closest to gate 60 first, then fragile-floor runnable,
  then distinctive starved; hazards deprioritized), research events FOR that Trend across MANY
  countries we don't already have (breadth — positives are one-per-country-year), curate,
  double-verify. `plan-a-trend` / `merge-a-trend` / `rank-trends` / `next-trend`. (3) **Mode B is
  now trend-agnostic + random + DEPTH-ESCALATING:** drive least-verified first — contested
  (needs_tiebreak) first, then depth-0, depth-1, … to `MAX_VERIFY_DEPTH=3` (double everything,
  then triple). `plan-b --max-depth --seed`; `depthWhy` replaces the retired §5.2 tier machinery
  (eventTier/tierWhy/P-constants deleted). (4) **A batch does BOTH modes → one PR** via the
  `/qgi-enrich-events` command (`.claude/commands/qgi-enrich-events.md`). Self-correcting loop:
  Mode B de-lists a fragile Trend, Mode A's auto-pick rescues it (top pick right now =
  technology_breakthrough, gap 3 — the one batch 1 de-listed).
- **2026-07-02** — **Batch 1 result (Mode B, 200 tier-1 fragile-floor):** conservative policy
  removed 52 unconfirmed TRUEs; `technology_breakthrough` 62→57 DE-LISTED (runnable→thin),
  `religious_and_social_movement` held at exactly 60. Expected per B1 ratification — the fix
  is Mode A backfill (both are Mode A priority categories). 26 events landed CONTESTED
  (TRUE-vs-FALSE clash) → auto-selectable for a pass-3 tiebreak in a later Mode B batch.
- **2026-07-04** — **Mode A CROSS-CATEGORY DEDUP GAP (recurring — check EVERY Mode A batch).**
  `merge-a-trend` + the research/curate agents dedup new candidates ONLY against the *target
  trend's* existing events (`existingTrendEvents` is trend-scoped), so a real government act
  already curated under a DIFFERENT category slips in as "new." Batch 3 leaked 10, batch 4 leaked
  5 more — all the SAME real act under another category (e.g. Denmark 2019 Climate Act already
  under climate_agreement; Ecuador 2023 Yasuní under energy_policy; Turkey 2020 Hagia Sophia under
  constitutional_change; Afghanistan 2001 Bamiyan under political_repression; Eswatini 2018
  renaming under executive_power_consolidation). **MANDATORY manual step until #1001 fixes it:**
  after `merge-a-trend`, scan the FULL candidate pool (not just kept-40) for same-(country,year)
  events across ALL categories in each country file (word-overlap≥2 heuristic), confirm same-act
  vs distinct-act by reading descriptions, then revert-all + exclude the same-act dups from the
  results + deterministic re-merge (cap backfills clean; since you scanned the whole pool, backfill
  can't add a new same-year dup). **Same-year scan MISSES cross-year same-incident overlaps** —
  batch 4's mali 2013 Ahmed Baba fire restated mali 2012 Timbuktu destruction (a multi-year crisis);
  Sonnet review caught it. Also scan ±1–2 years / by incident keywords, and trim overlapping context
  prose (description is NOT a join key, safe to edit) rather than dropping a genuinely-distinct dated
  act. KEEP genuinely-distinct acts same year/actor (batch 3: mauritius
  emergency-decl ≠ spill, vietnam Formosa ≠ corruption-bundle; batch 4: tonga coronation ≠
  power-ceding). Rule of thumb: SAME act (same law/referendum/decree/ceremony) = drop; DIFFERENT
  act same incident = keep + flag.
- **2026-07-04** — **CHRONIC CONTESTED events exist (need a park-after-N policy — #1001).** Some
  events are genuinely un-resolvable by more passes: india 2024 "surpasses China in FDI" (metric-
  dependent), botswana 1987 "middle-income status" (undocumented exact year — now at verify_count
  5!), tunisia 1951 "nationalist strikes" (1951-vs-1952 dating dispute). Verifiers keep returning
  UNCERTAIN/PARTIAL so consensus stays CONTESTED, and contested-first selection re-picks them EVERY
  Mode B batch (3 wasted passes/batch, forever). top-level verdict stays CONTESTED so they never
  leak as false positives — harmless but wasteful. Fix: cap tiebreak attempts (e.g. after 3
  tiebreak passes with no majority → park as permanently CONTESTED, stop auto-selecting).
- **2026-07-04** — **Activating a country floods the depth-0 pool.** When Mode A creates a country's
  FIRST verification file (batch 3: antigua/cabo_verde/malta/samoa), ALL that country's other
  curated events (30–57 each) become depth-0 selectable for Mode B (they were excluded while the
  country had no verification file — 37–39 "countries w/o verification" stay out entirely). So the
  depth-0 total can GROW after a batch (batch 3→4: 261→330). Expected/desirable (Mode B then drains
  them), not a bug — but it means "activated" small countries dominate the next Mode B depth-0 batch.
- **2026-07-04** — **consolidate-b `--results` MUST be `{results:[...]}` (wrapped).** A bare array
  silently no-ops (events_updated:0, empty consensus) because the CLI reads `results.results ?? []`.
  Extract from the task `.output` as `{mode:'B', results: <o.result.results>}`. (merge-a-trend reads
  `results.events`, so pass the whole `o.result` object there.)
- **2026-07-10** — **TARGETED Mode A (arg = trend slug + steered research).** To enrich a specific
  RUNNABLE trend at specific countries (e.g. ML asked for banking EM coverage): `plan-a-trend --trend X`,
  then POST-PROCESS the plan — append a targeting block to each `researchAgents[].researchPrompt`
  (priority country slices + seed onset-years + hard rules) and raise `caps.TREND_CANDIDATES_TARGET` if
  you want >40. The fleet still independently double-verifies (born-verified bar preserved). Banking
  batch: 58 steered EM countries → 47 kept → banking 76→116, 14/16 big-EM.
- **2026-07-10** — **Revert-to-drop gotcha (Mode-A dedup):** `git checkout main -- <dir>` does NOT
  delete files ABSENT from main. When reverting a Mode-A batch to drop N events + re-merge, a NEWLY-
  CREATED verification file for a dropped country survives the checkout and merges as an ORPHAN (no
  curated twin → not a positive, but a stray file + validator warning). ALWAYS explicitly
  `rm events/verification/<dropped-new-country>.json` after the checkout. (benin.json leaked in #80,
  cleaned in #81.)
- **2026-07-10** — **Twin-crisis events are LEGIT for banking (not curation-artifact dups).** A twin
  crisis (banking+currency, e.g. mexico 1994) can be curated under banking AND currency_crisis as
  SEPARATE entries with DISTINCT facts (FOBAPROA bailout vs peso devaluation) — kept, because each
  feeds a different recipe (per-Trend D2 training, no within-recipe double-count). This is the EM
  external-fragility signal the ML wants. BUT drop NEAR-VERBATIM restatements where the two entries
  describe the same event with no distinct facet (benin/moldova 'Banking System Collapse' already under
  economic_recession). Rule: distinct banking-specific facts (bank failures/bailouts/runs) = KEEP;
  same-story-relabelled = DROP. gh token this session came from `~/.secrets/qgi-claude-gh-pat.txt`
  (git credential fill returned empty; use the PAT file + credential.helper x-access-token).
