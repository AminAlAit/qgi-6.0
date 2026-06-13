# QGI-GPR v2 (expanded dictionary) — re-validation vs 44 published GPR countries

**Status:** production-push result, 2026-06-14. v3.0.0 dictionary (weapons/terror tokens
promoted + 3 wrong-name tokens corrected for recall) re-scanned into gkg_gpr_flags_v2
(+ matched_themes future-proofing column). Re-validated vs Caldara–Iacoviello's 44 GPRC.

## Headline: the expanded dictionary did NOT move the needle.

| Metric | v1 (frozen P1) | v2 (expanded v3) |
|---|---|---|
| mean delta-Spearman (44) | 0.4589 | **0.4604** (+0.0015) |
| countries >= 0.35 | 37/44 | 38/44 |
| countries at r>0.9 (levels) | 0/44 | **0/44** (max 0.85, HUN) |

Per-country moves are all < 0.04 (noise): biggest gain CHL +0.034, biggest drop PRT -0.035.

## What this means (honest)
- **The gap to r>0.9 is NOT a keyword-coverage problem.** Adding the weapons/military/terror
  tokens + fixing the recall tokens changed nothing meaningful. The ceiling (~0.46 delta-Spearman,
  ~0.85 max levels-Pearson) is set by the **corpus difference** — GDELT's machine-coded global
  crawl vs Iacoviello's 10 curated English broadsheets + his 1985-anchored normalization. No
  keyword tuning closes that.
- **The signal is ROBUST.** Two very different dictionaries (frozen P1 vs expanded v3) give the
  SAME 0.46 — strong evidence it's a real, stable signal, not a dictionary artifact.
- **The re-scan was still worth it:** it ruled out the keyword hypothesis (real science), built
  the matched_themes column (future dictionary tweaks now ~$0.30, not a $10 re-scan), and the
  recall-corrected v2 table is the cleaner one to keep.

## Verdict
QGI-GPR is a **validated movement-tracking signal** (~0.46 delta-Spearman, 84% of countries) — a
**confirmation layer**, NOT a levels-replica of the published GPR (GDELT cannot be that). Ship it
with per-country quality tiers (Tier A featured, Tier C honestly flagged). The strict r>0.9 bar is
**not achievable** by this construction; the only untested lever is a non-linear gap-closer
regressor (uncertain), otherwise the validated signal is the deliverable.
