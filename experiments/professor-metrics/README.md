# professor-metrics — exact confusion matrices from persisted OOF predictions

Built 2026-08-05 for the External Domain Advisor review (see
`qgi-docs/internal/ml-track/professor-prep/`). He asked for a **detailed confusion matrix**
from the QGI methodology and testing.

## What this adds over the June sheet

The June per-recipe sheet (`QGI-TE-per-recipe-metrics.pdf`) gave, per recipe, one confusion
matrix at a single 0.50 threshold, and its PR-AUC was **derived from pooled reliability
bins** — not per-instance scores. `confusion_report.py` consumes the raw out-of-fold rows a
walk already emits (`{country, year, prob, label}`) and produces:

| Output | Why an ML reviewer wants it |
|---|---|
| Confusion matrix at any threshold + full sweep (0.1–0.9) | The 0.50 cut is arbitrary; the P/R trade is the real picture |
| **Exact** ROC-AUC and PR-AUC (average precision) | Removes the bin-derivation caveat we had to disclose in June |
| F1-optimal and MCC-optimal operating points | Exact — searched over observed scores, not a grid |
| Precision@top-5/10/20% + lift over base rate | "What if someone acts on a high score" — decision-relevant |
| **Per-cohort** confusion (fragile-state / mid-tier / stable-democracy) | Discrimination is strongly cohort-conditional — see finding below |
| Per-country breakdown | Makes single-country dominance visible |
| Brier score, balanced accuracy, specificity, MCC | Standard imbalanced-binary reporting |

## Validation

Recomputed `roc_auc_exact` reproduces each source file's own `loco_auc` to 4 decimals on all
5 recipes — the repo's "reproduce a known number before trusting a sweep" rule
(`qgi-docs/internal/rnd/rnd-state-of-play-and-lessons.md` §2). Tests: `python -m pytest
test_confusion_report.py -q` → 19 passed, including a cross-check that reconstructs the
published currency_crisis cell layout (19/19/31/143 → P 0.50 / R 0.38 / F1 0.43) so a silent
FP/FN convention flip between the June sheet and this tool would fail loudly.

## ⚠️ Provenance — read before quoting any number from here

An OOF file carries the AUC of **whatever configuration produced it**. The five
`run-3.1-pilot/results/*.run2.json` files used here are at the run-2 **card window**, so
several reproduce the pre-correction, window-optimistic values that the 2026-07-12 fleet
honesty audit superseded — most starkly `banking_and_financial_crisis` at **0.771**, whose
honest re-measured value is **0.638**. `summarize()` echoes the source file's own AUC into
`source_reported` so the configuration travels with the numbers. **Do not present these five
as current QGI performance.** They demonstrate the *method*.

## The finding worth reporting

Per-cohort discrimination is **strongly cohort-conditional, and the direction differs by
trend** (`results/cohort-discrimination.md`):

- `military_coup` and `territorial_disputes` work in **fragile states** (ROC 0.70 / 0.76) and
  collapse to chance in mid-tier (0.53 / 0.57).
- `banking_and_financial_crisis` is the opposite — it works in **stable democracies**
  (ROC 0.753, n_pos 40) and is at chance in mid-tier (0.531).
- **mid-tier is the weakest cohort in 5 of 5 recipes** (0.530–0.633). The hard middle.

Caveat, stated loudly: several cohort cells are small (banking fragile-state n=20; coup
stable-democracy n_pos=4). Small-n cohort AUCs are noisy and must not be over-read.

## Running it

Host Python only — no Docker, no xgboost, no panels needed (this is the *reporting* half):

```
cd qgi-ml/experiments/professor-metrics
python confusion_report.py ../run-3.1-pilot/results/military_coup.run2.json --out results/confusion_report.json
```

## To produce this for all 42 live recipes

Blocked on two things, both restorable:
1. **Docker ML image** `qgi-run31-pilot:py313` running (daemon was off 2026-08-05).
2. **`qgi-ml/data/parquet_panels/` restored from S3** — currently empty locally.

Then re-walk with `stability_select._final_fit(indicators, samples, panels, seed=12345)`
(re-argmaxing the window — the honest primitive), persist its `oof` array per recipe, and
point this script at the outputs. `_final_fit` already returns `oof`; the fleet audit simply
did not persist it.
