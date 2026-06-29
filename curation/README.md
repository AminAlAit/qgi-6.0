# §G what_happened_next curation — pipeline state

Backend working state for the analogue-narrative curation (moved out of C:/tmp 2026-06-10).

- `ledger.json` — accepted blurbs, keyed `iso2-year` → {blurb,sources,confidence,status,wave}. **Source of truth.**
- `parked.json` — needs human review. `abstained.json` — no salient event (never retry).
- `events_all.json` — the 3,440 unique (country,year) events sorted by analog frequency.
- `goldset.json` — calibration gold-set + planted errors (evidence).
- `curation-wave.template.js` — the locked-v3 workflow template (`__EVENTS_JSON__` placeholder).
- `wp*.js` — per-wave generated workflow scripts (gitignored, regenerable).

Per wave: build `wpNN.js` from template (top-70 of events NOT in ledger∪parked∪abstained) → run via Workflow(scriptPath) → merge results into ledger/parked/abstained → republish `qgi-frontend/data/curation/what-happened-next.json`.
Handoff/how-to MDs live in `qgi-docs/internal/ops/what-happened-next-*`.
