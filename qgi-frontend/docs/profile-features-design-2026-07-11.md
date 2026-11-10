# User-Profile Features — 5-Persona Design Synthesis (2026-07-11)

Five Sonnet personas designed the profile-configurable features each would want. This
synthesizes their memos into a prioritized, tiered spec + a build order. Personas:
**Yasmin Farouk** (EM sovereign-risk analyst), **Marcus Delaney** (global-macro PM),
**Priya Ramaswamy** (corporate strategy / supply-chain), **Amb. Henrik Sørensen**
(foreign-policy analyst), **Dr. Wei Chen** (quant researcher).

## The one thing they all built first

**Watchlist / Coverage universe** — a saved set of countries (macro & analyst want
country×**trend** pairs) that becomes the **default lens** on Risk Board, Briefing, and
Trends instead of the full ~190-country grid. **All 5 ranked this #1 or as the prerequisite
for everything else.** Free (capped ~5–15) / Pro (unlimited + multiple named lists).

## Architectural blocker (flagged by macro PM + quant, confirmed in code)

There is **no per-user settings store** — sessions are stateless Cognito JWTs. The watchlist
is the first feature that needs persistence, so the real first decision is _where settings
live_. **Recommendation: a DynamoDB `qgi-user-settings` table keyed by the Cognito `sub`** —
matches the existing AWS stack, cheap, multi-device. (Device-local free toggles could start
in `localStorage` to ship value before the table lands.)

## Feature spec (ranked by cross-persona value)

| #   | Feature                                                                           | Control               | Tier             | Cx  | Backers                   |
| --- | --------------------------------------------------------------------------------- | --------------------- | ---------------- | --- | ------------------------- |
| 1   | **Watchlist** (countries, opt. ×trend) → default lens                             | multi-select          | Free/Pro         | M   | all 5                     |
| 2   | **Default landing view** (Briefing vs Risk Board→watchlist)                       | single-select         | Free             | S   | 4                         |
| 3   | **Trend focus / allowlist** (show only trends I act on)                           | multi-select + preset | Free             | S   | all 5                     |
| 4   | **Methodology verbosity** (recipe components + CIs shown by default)              | slider/toggle         | Free             | S   | Sørensen #1, Chen         |
| 5   | **Analogue confidence floor** (hide weak matches; aggregate-only below cutoff)    | threshold             | Free             | S   | 4                         |
| 6   | **Score/tier-move alerts** scoped to watchlist                                    | threshold + toggle    | Pro              | L   | all 5                     |
| 6b  | **Quadrant-crossing alert** ("Elevated & Quiet → Both Firing")                    | select                | Pro              | L   | Delaney's #1              |
| 7   | **Digest** (weekly, watchlist-scoped)                                             | cadence picker        | Free(mo)/Pro(wk) | L   | 3                         |
| 8   | **Delivery channel** (email / webhook / Slack)                                    | select + url          | Pro              | M   | Delaney, Chen             |
| 9   | **API key manager** (scoped, revocable tokens)                                    | key manager           | Pro              | M   | Chen #1, Delaney          |
| 10  | **Export defaults + bulk export** (CSV/JSON/Parquet)                              | select + action       | Pro              | M   | Chen, Ramaswamy, Sørensen |
| 11  | **Citation/methodology footnote on exports** (version, backtest metrics, vintage) | toggle + style        | Pro              | M   | Sørensen, Farouk          |
| 12  | **Scoring-version pin** (reproducibility)                                         | version pinner        | Pro              | M   | Chen                      |
| 13  | **Data-vintage pin** (freeze the bake I cited)                                    | select                | Pro              | L   | Farouk, Chen              |
| 14  | **Saved comparison sets** (Compare page)                                          | named multi-select    | Free/Pro         | S   | 3                         |
| 15  | **Raw-score / units toggle** (z-score/salience vs tier badges)                    | select                | Free/Pro         | S/M | Chen                      |
| 16  | **Analyst-vs-Executive detail mode**                                              | single-select         | Free             | S   | Farouk                    |

## Unanimous anti-features (do NOT build)

1. **User-tunable scoring weights / threshold recalibration.** All 5 independently rejected
   it: _"the score has to be one shared fact everyone argues about, not a knob everyone
   argues with."_ Keep the model locked; cite methodology instead. **This is the strongest
   signal in the whole exercise.**
2. **Cosmetic personalization** (themes, accent colors, widget layouts) — SaaS filler,
   support surface, zero analytical value (Chen, Farouk).
3. **A "clean export" mode that hides confidence tiers/CIs** — inverts the methodology
   charter's own red line; a liability generator (Sørensen).
4. **Flattening Analogues to one named "twin"** — keep the ranked list; ties to the
   no-fabricated-analogs guardrail (Sørensen, Chen).
5. **Persisting `?mode=presentation` as a default** — a demo concern, not a user one (Chen).

## Recommended build order

1. **Persistence layer** — DynamoDB `qgi-user-settings` (keyed by `sub`). Unblocks all.
2. **Free quick wins** (all S): #2 default landing, #3 trend focus, #4 methodology verbosity,
   #5 analogue floor. High value, low cost.
3. **#1 Watchlist** — the unanimous top feature; wire as the default lens.
4. **Pro alerting** (#6/#6b/#7/#8) — the monetizable core; quadrant-crossing is the headline.
5. **Quant/data-pro** (#9/#10/#12) — API keys, exports, version pin (needs retained bakes).

Full persona memos are preserved in the session transcript.
