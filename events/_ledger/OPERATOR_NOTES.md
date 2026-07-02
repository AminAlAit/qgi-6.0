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
